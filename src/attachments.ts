/**
 * Qwen-MM image attachment bridge.
 *
 * The twin vision route (`qwen-mm-vision`) declares image input so the host
 * image-intake gate admits uploads, but the underlying DeepSeek API is
 * text-only — image blocks must never reach the wire. This bridge exports
 * every image block in the claimed messages to local files (a deterministic
 * content-addressed store under the dsh home, plus a copy inside the session
 * workspace), rewrites the blocks into path-reference text, and injects a
 * system reminder naming the qwen-mm MCP tools that read them
 * (`mcp__qwen-mm-plugins-api__vision_chat`,
 * `mcp__qwen-mm-plugins-core__read_image`).
 *
 * @module @deepseek-ai/dsh-qwen-mm/attachments
 */

import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { TextBlock, UserMessage } from '@deepseek-ai/dsh-llm'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { readSettings } from './settings.ts'

/** Cordis plugin name. */
export const name = 'qwen-mm-attachments'
/** Service required by the bridge (the durable attachment seam). */
export const inject = ['attachments']

/** Bridge configuration. */
export interface Config {
  /** Directory exported image files land in; defaults to `<dshHome>/qwen-mm/attachments`. */
  readonly exportDir?: string
  /** Directory for the per-session workspace copy; defaults to `<sessionCwd>/qwen-mm`. */
  readonly workspaceDir?: string
}

/** Config schema for the loader; an omitted value falls back at apply time. */
export const Config: Schema<Config> = z.object({
  exportDir: z.string(),
  workspaceDir: z.string(),
})

const MEDIA_EXT: Record<ImageAttachmentRef['mediaType'], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** One exported image file. */
export interface ExportedImage {
  /** Content-addressed attachment id with any `sha256:` scheme stripped. */
  readonly id: string
  /** Absolute path of the exported file. */
  readonly path: string
}

/** Bytes reader abstraction, kept separate so tests can inject a fake. */
export type ImageReader = (
  ref: ImageAttachmentRef,
  signal: AbortSignal,
) => Promise<{ readonly data: Uint8Array }>

/**
 * Deterministic on-disk name for one attachment: `<sha256-hex>.<ext>`.
 * Content addressing makes the name stable, so re-exporting the same image
 * is idempotent and never duplicates a file.
 * @param ref - the durable image reference.
 * @returns the file name for the exported copy.
 */
export function exportFileName(ref: ImageAttachmentRef): string {
  const id = String(ref.attachmentId).replace(/^sha256:/, '')
  return `${id}.${MEDIA_EXT[ref.mediaType]}`
}

/**
 * Export every image block in the messages to `exportDir`, returning the
 * exported files in first-seen order. Existing files are skipped (idempotent
 * by content addressing).
 * @param reader - reads one attachment's verified bytes.
 * @param exportDir - destination directory; created on first write.
 * @param messages - the claimed user messages scanned for image blocks.
 * @param signal - the current step's abort signal.
 * @returns the exported files, one per unique image block.
 */
export async function exportImages(
  reader: ImageReader,
  exportDir: string,
  messages: readonly UserMessage[],
  signal: AbortSignal,
): Promise<ExportedImage[]> {
  const exported: ExportedImage[] = []
  const seen = new Set<string>()
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type !== 'image') continue
      const id = String(block.attachment.attachmentId).replace(/^sha256:/, '')
      if (seen.has(id)) continue
      seen.add(id)
      const path = join(exportDir, exportFileName(block.attachment))
      try {
        await access(path)
      } catch {
        const { data } = await reader(block.attachment, signal)
        signal.throwIfAborted()
        await mkdir(exportDir, { recursive: true })
        await writeFile(path, data, { flag: 'wx' })
      }
      exported.push({ id, path })
    }
  }
  return exported
}

/**
 * Mirror already-exported files into a workspace directory (used so the model
 * can reach the copy through both MCP tools and ordinary file tools). Files
 * that already exist there are skipped; the returned list points at the
 * workspace copies.
 * @param exported - the files written to the export store.
 * @param workspaceDir - destination directory; created on first write.
 * @returns the mirrored files (same ids, workspace paths).
 */
export async function mirrorToWorkspace(
  exported: readonly ExportedImage[],
  workspaceDir: string,
): Promise<ExportedImage[]> {
  const mirrored: ExportedImage[] = []
  await mkdir(workspaceDir, { recursive: true })
  for (const file of exported) {
    const target = join(workspaceDir, basename(file.path))
    try {
      await access(target)
    } catch {
      await copyFile(file.path, target)
    }
    mirrored.push({ id: file.id, path: target })
  }
  return mirrored
}

/** The session's workspace root, or undefined when the session carries no cwd. */
export function workspaceRootFor(agent: Agent): string | undefined {
  const header = (agent.session as { header?: { cwd?: string } }).header
  return header?.cwd
}

/**
 * Rewrite messages, replacing each image block with a text block naming its
 * exported path, so a text-only route never receives an image block.
 * @param messages - the messages to rewrite.
 * @param pathById - exported path per stripped attachment id.
 * @returns rewritten copies for messages that contained images; other
 *   messages pass through unchanged.
 */
export function rewriteMessages(
  messages: readonly UserMessage[],
  pathById: ReadonlyMap<string, string>,
): UserMessage[] {
  return messages.map(message => {
    if (!message.content.some(block => block.type === 'image')) return message
    const content = message.content.map(block => {
      if (block.type !== 'image') return block
      const id = String(block.attachment.attachmentId).replace(/^sha256:/, '')
      const path = pathById.get(id)
      const text: TextBlock = { type: 'text', text: `[Image attachment exported to: ${path ?? '<missing>'}]` }
      return text
    })
    return createUserMessage({ content, source: message.source })
  })
}

/**
 * Render the injected guidance reminder naming the exported files and the
 * qwen-mm MCP tools that read them.
 * @param files - the exported image files (workspace copies preferred).
 * @returns the verbatim `<system-reminder>` body.
 */
export function renderReminder(files: readonly ExportedImage[]): string {
  return [
    '<system-reminder>',
    'Images in the user\'s latest message were exported to local files so the qwen-mm MCP tools can read them (the chat route itself is text-only). Understand a picture via cloud Qwen VL with `mcp__qwen-mm-plugins-api__vision_chat` (e.g. `images: ["<path>"]`), or read it locally with `mcp__qwen-mm-plugins-core__read_image` (`image_path: "<path>"`). Exported files:',
    ...files.map(file => `- ${file.path}`),
    '</system-reminder>',
  ].join('\n')
}

/** Register the attachment bridge: export images, copy them into the workspace, and rewrite image blocks. */
export function apply(ctx: Context, config: Config): void {
  const settings = readSettings(ctx)
  if (settings.bridgeEnabled === false) {
    ctx.logger.info('qwen-mm-attachments: disabled via settings (dsh-qwen-mm.bridgeEnabled=false)')
    return
  }
  const exportDir = config.exportDir ?? settings.exportDir ?? join(resolveDshHome(), 'qwen-mm', 'attachments')
  ctx.on('agent/pre-step', async ({ agent, messages, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    const exported = await exportImages(
      (ref, sig) => ctx.attachments.readImage(ref, sig),
      exportDir,
      messages,
      signal,
    )
    if (exported.length === 0) return decision

    // Prefer workspace copies when the session has a workspace; they are
    // reachable with ordinary file tools as well as the MCP readers.
    const workspace = config.workspaceDir ?? settings.workspaceDir ?? workspaceRootFor(agent)
    const preferred = workspace === undefined
      ? exported
      : await mirrorToWorkspace(exported, join(workspace, 'qwen-mm'))

    const pathById = new Map(preferred.map(file => [file.id, file.path]))
    const rewritten = rewriteMessages(decision.messages, pathById)
    const reminder = createUserMessage({
      content: [{ type: 'text', text: renderReminder(preferred) }],
      source: { kind: 'plugin', plugin: 'qwen-mm' },
    })
    return { kind: 'enter', messages: [...rewritten, reminder] }
  })
}