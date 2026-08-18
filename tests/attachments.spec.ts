/**
 * `@deepseek-ai/dsh-qwen-mm/attachments` — image export (store + workspace
 * mirror), path rewriting, and reminder injection through the pre-step
 * waterfall. The bridge always rewrites: the twin vision route handles
 * admission, the underlying chat route is text-only by construction.
 */

import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm'
import { agentEvents, Inbox, type Agent } from '@deepseek-ai/dsh-agent'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import * as Attachments from '@deepseek-ai/dsh-qwen-mm/attachments'

const signal = new AbortController().signal

function imageRef(id: string, mediaType: ImageAttachmentRef['mediaType'] = 'image/png'): ImageAttachmentRef {
  return {
    attachmentId: `sha256:${id}` as ImageAttachmentRef['attachmentId'],
    mediaType,
    bytes: 4,
    width: 2,
    height: 2,
  }
}

function messageWithImage(id: string, mediaType?: ImageAttachmentRef['mediaType']): UserMessage {
  return createUserMessage({
    content: [{ type: 'image', attachment: imageRef(id, mediaType) }, { type: 'text', text: '看这张图' }],
    source: { kind: 'user' },
  })
}

function textMessage(text: string): UserMessage {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

async function tempDir(name: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `dsh-${name}-`))
}

function stubAgent(options: { cwd?: string; header?: { provider: string; model: string } }): Agent {
  const session = Session.create(SessionId('attachments-agent'), [], {
    version: 0,
    id: SessionId('attachments-agent'),
    createdAt: 0,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  })
  const sessionWithHeader = Object.assign(session, {
    requestHeader: () => (options.header === undefined ? undefined : { config: options.header }),
  })
  return {
    ctx: new Context(),
    id: SessionId('attachments-agent'),
    options: {},
    session: sessionWithHeader,
    inbox: new Inbox(sessionWithHeader, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

describe('attachment bridge helpers', () => {
  it('maps media types to deterministic file names', () => {
    expect(Attachments.exportFileName(imageRef('a'.repeat(64), 'image/png'))).toBe(`${'a'.repeat(64)}.png`)
    expect(Attachments.exportFileName(imageRef('b'.repeat(64), 'image/jpeg'))).toBe(`${'b'.repeat(64)}.jpg`)
    expect(Attachments.exportFileName(imageRef('c'.repeat(64), 'image/webp'))).toBe(`${'c'.repeat(64)}.webp`)
    expect(Attachments.exportFileName(imageRef('d'.repeat(64), 'image/gif'))).toBe(`${'d'.repeat(64)}.gif`)
  })

  it('exports unique image blocks, skipping existing files', async () => {
    const dir = await tempDir('attach-export')
    const written = new Set<string>()
    const reader = async (ref: ImageAttachmentRef) => {
      written.add(String(ref.attachmentId))
      return { data: new Uint8Array([1, 2, 3]) }
    }
    const messages = [messageWithImage('a'.repeat(64)), messageWithImage('a'.repeat(64)), messageWithImage('b'.repeat(64))]
    const exported = await Attachments.exportImages(reader, dir, messages, signal)
    expect(exported.map(file => file.id)).toEqual(['a'.repeat(64), 'b'.repeat(64)])
    expect(written).toEqual(new Set([`sha256:${'a'.repeat(64)}`, `sha256:${'b'.repeat(64)}`]))
    expect((await readFile(join(dir, `${'a'.repeat(64)}.png`))).length).toBe(3)
    // Re-export: existing files are not rewritten.
    const again = await Attachments.exportImages(reader, dir, messages, signal)
    expect(again).toHaveLength(2)
    expect(written.size).toBe(2)
  })

  it('mirrors exported files into a workspace directory', async () => {
    const dir = await tempDir('attach-export')
    const workspace = await tempDir('attach-workspace')
    const reader = async () => ({ data: new Uint8Array([1, 2, 3]) })
    const exported = await Attachments.exportImages(reader, dir, [messageWithImage('a'.repeat(64))], signal)
    const mirrored = await Attachments.mirrorToWorkspace(exported, workspace)
    expect(mirrored[0]?.path).toBe(join(workspace, `${'a'.repeat(64)}.png`))
    expect((await readFile(mirrored[0]!.path)).length).toBe(3)
    // Idempotent: existing workspace copies are not rewritten.
    const again = await Attachments.mirrorToWorkspace(exported, workspace)
    expect(again[0]?.path).toBe(mirrored[0]?.path)
  })

  it('reads the session workspace root from the session header cwd', () => {
    const agent = stubAgent({ cwd: 'C:\\work\\project' })
    expect(Attachments.workspaceRootFor(agent)).toBe('C:\\work\\project')
    expect(Attachments.workspaceRootFor(stubAgent({}))).toBeUndefined()
  })

  it('rewrites image blocks into path references and passes other messages through', () => {
    const byId = new Map<string, string>([[`${'a'.repeat(64)}`, '/tmp/export/a.png']])
    const withImage = messageWithImage('a'.repeat(64))
    const plain = textMessage('hello')
    const [rewritten, untouched] = Attachments.rewriteMessages([withImage, plain], byId)
    if (rewritten === undefined) throw new Error('expected a rewritten message')
    expect(rewritten.content).toEqual([
      { type: 'text', text: `[Image attachment exported to: /tmp/export/a.png]` },
      { type: 'text', text: '看这张图' },
    ])
    expect(untouched).toBe(plain)
  })

  it('renders a missing-path marker when no export exists for an id', () => {
    const [rewritten] = Attachments.rewriteMessages([messageWithImage('b'.repeat(64))], new Map())
    expect(rewritten?.content[0]).toEqual({ type: 'text', text: '[Image attachment exported to: <missing>]' })
  })

  it('renders the reminder verbatim with exported paths', () => {
    const text = Attachments.renderReminder([
      { id: 'a'.repeat(64), path: '/tmp/export/a.png' },
      { id: 'b'.repeat(64), path: '/tmp/export/b.png' },
    ])
    expect(text).toContain('<system-reminder>')
    expect(text).toContain('mcp__qwen-mm-plugins-api__vision_chat')
    expect(text).toContain('mcp__qwen-mm-plugins-core__read_image')
    expect(text).toContain('- /tmp/export/a.png')
    expect(text).toContain('- /tmp/export/b.png')
    expect(text.endsWith('</system-reminder>')).toBe(true)
  })
})

describe('attachment bridge plugin', () => {
  async function setup(exportDir: string, workspaceDir?: string): Promise<{ ctx: Context; imageBytes: Uint8Array }> {
    const ctx = new Context()
    const imageBytes = new Uint8Array([9, 8, 7])
    ctx.provide('attachments', {
      readImage: async () => ({ ref: imageRef('a'.repeat(64)), data: imageBytes }),
    } as never)
    await ctx.plugin(Attachments, { exportDir, ...(workspaceDir === undefined ? {} : { workspaceDir }) })
    return { ctx, imageBytes }
  }

  async function firePreStep(ctx: Context, agent: Agent, messages: UserMessage[]): Promise<{ kind: 'enter'; messages: UserMessage[] } | { kind: 'reject' }> {
    return await agentEvents(ctx, agent).waterfall(
      'agent/pre-step',
      { messages, turn: 1, step: 1, signal },
      () => Promise.resolve({ kind: 'enter' as const, messages }),
    )
  }

  it('exports, mirrors into the workspace, and rewrites images on any route', async () => {
    const dir = await tempDir('attach-plugin')
    const workspace = await tempDir('attach-plugin-ws')
    const { ctx } = await setup(dir, workspace)
    const agent = stubAgent({ cwd: workspace })
    const imageMessage = messageWithImage('a'.repeat(64))
    const decision = await firePreStep(ctx, agent, [imageMessage, textMessage('普通文字')])
    if (decision.kind !== 'enter') throw new Error('expected enter decision')
    const [rewritten, plain, reminder] = decision.messages
    if (rewritten === undefined || plain === undefined || reminder === undefined) throw new Error('expected three messages')
    // The workspace copy wins for the path reference.
    expect(rewritten.content[0]).toEqual({ type: 'text', text: `[Image attachment exported to: ${join(workspace, 'qwen-mm', `${'a'.repeat(64)}.png`)}]` })
    expect(plain.content).toEqual([{ type: 'text', text: '普通文字' }])
    expect((await readFile(join(workspace, 'qwen-mm', `${'a'.repeat(64)}.png`))).length).toBe(3)
    expect((reminder.content[0] as { text: string }).text).toContain(join(workspace, 'qwen-mm', `${'a'.repeat(64)}.png`))
  })

  it('falls back to the store path when the session has no workspace', async () => {
    const dir = await tempDir('attach-plugin-no-ws')
    const { ctx } = await setup(dir)
    const agent = stubAgent({})
    const decision = await firePreStep(ctx, agent, [messageWithImage('a'.repeat(64))])
    if (decision.kind !== 'enter') throw new Error('expected enter decision')
    const [rewritten] = decision.messages
    expect(rewritten?.content[0]).toEqual({ type: 'text', text: `[Image attachment exported to: ${join(dir, `${'a'.repeat(64)}.png`)}]` })
  })

  it('passes a downstream reject through untouched', async () => {
    const dir = await tempDir('attach-plugin-reject')
    const { ctx } = await setup(dir)
    const agent = stubAgent({})
    const decision = await agentEvents(ctx, agent).waterfall(
      'agent/pre-step',
      { messages: [messageWithImage('a'.repeat(64))], turn: 1, step: 1, signal },
      () => Promise.resolve({ kind: 'reject' }),
    )
    expect(decision).toEqual({ kind: 'reject' })
  })

  it('leaves a step untouched when no message carries an image', async () => {
    const dir = await tempDir('attach-plugin-plain')
    const { ctx } = await setup(dir)
    const agent = stubAgent({})
    const plain = textMessage('普通文字')
    const decision = await firePreStep(ctx, agent, [plain])
    if (decision.kind !== 'enter') throw new Error('expected enter decision')
    expect(decision.messages).toEqual([plain])
  })

  it('falls back to the default export dir when config omits it', async () => {
    const ctx = new Context()
    ctx.provide('attachments', { readImage: async () => ({ ref: imageRef('a'.repeat(64)), data: new Uint8Array([1]) }) } as never)
    await ctx.plugin(Attachments, {})
    const agent = stubAgent({})
    const decision = await firePreStep(ctx, agent, [textMessage('no image')])
    if (decision.kind !== 'enter') throw new Error('expected enter decision')
    expect(decision.messages).toHaveLength(1)
  })
})