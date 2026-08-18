/**
 * `@deepseek-ai/dsh-qwen-mm/vision` — twin provider registration, image
 * modality advertisement, default-selection steering, and request steering.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as Vision from '@deepseek-ai/dsh-qwen-mm/vision'
import type { LlmAdapter } from '@deepseek-ai/dsh-llm'

const signal = new AbortController().signal

interface FakeLlm {
  providers: string[]
  registered: Array<{ providers: string[]; adapter: LlmAdapter }>
}

function fakeLlm(providers: string[] = ['deepseek']): FakeLlm {
  const registered: FakeLlm['registered'] = []
  return {
    providers,
    registered,
    listProviders: () => providers.map(id => ({ id, name: id })),
    registerAdapter: (ps: string[], adapter: LlmAdapter) => {
      registered.push({ providers: ps, adapter })
      return () => {}
    },
    stream: async () => { throw new Error('not exercised') },
  } as unknown as FakeLlm
}

interface FakeDefaults {
  saved: Array<Record<string, unknown>>
  current: { provider: string; model: string }
}

function fakeDefaults(current = { provider: 'deepseek', model: 'deepseek-chat' }): FakeDefaults {
  const saved: FakeDefaults['saved'] = []
  return {
    saved,
    current,
    currentSelection: () => current,
    saveSelection: async (next: Record<string, unknown>) => { saved.push(next) },
  } as unknown as FakeDefaults
}

function contextWith(llm: unknown, defaults: unknown): Context {
  const ctx = new Context()
  ctx.provide('llm', llm as never)
  ctx.provide('agentDefaultModel', defaults as never)
  return ctx
}

describe('qwen-mm-vision twin route', () => {
  it('registers a twin provider whose models declare image input', async () => {
    const llm = fakeLlm(['deepseek'])
    const ctx = contextWith(llm, fakeDefaults())
    await ctx.plugin(Vision, {})

    expect(llm.registered).toHaveLength(1)
    expect(llm.registered[0]?.providers).toEqual(['qwen-mm-vision'])
    const adapter = llm.registered[0]!.adapter
    expect(adapter.providerInfo('qwen-mm-vision')).toEqual({ id: 'qwen-mm-vision', name: 'DeepSeek (Vision)' })
    const info = adapter.resolveModel('qwen-mm-vision', 'deepseek-chat')
    expect(info.inputModalities).toContain('image')
  })

  it('steers the default model selection to the twin when the default is the source', async () => {
    const defaults = fakeDefaults({ provider: 'deepseek', model: 'deepseek-chat' })
    const ctx = contextWith(fakeLlm(['deepseek']), defaults)
    await ctx.plugin(Vision, {})

    expect(defaults.saved).toEqual([{ provider: 'qwen-mm-vision', model: 'deepseek-chat' }])
  })

  it('leaves an explicit default on another provider untouched', async () => {
    const defaults = fakeDefaults({ provider: 'pi-ai', model: 'qwen-vl' })
    const ctx = contextWith(fakeLlm(['deepseek', 'pi-ai']), defaults)
    await ctx.plugin(Vision, {})

    expect(defaults.saved).toEqual([])
  })

  it('redirects request configs from the source route to the twin', async () => {
    const ctx = contextWith(fakeLlm(['deepseek']), fakeDefaults())
    await ctx.plugin(Vision, {})

    const proposed = await ctx.waterfall(
      'agent/request',
      { turn: 1, step: 1, signal },
      () => Promise.resolve({ provider: 'deepseek', model: 'deepseek-chat' }),
    )
    expect(proposed).toEqual({ provider: 'qwen-mm-vision', model: 'deepseek-chat' })

    const untouched = await ctx.waterfall(
      'agent/request',
      { turn: 1, step: 1, signal },
      () => Promise.resolve({ provider: 'pi-ai', model: 'qwen-vl' }),
    )
    expect(untouched).toEqual({ provider: 'pi-ai', model: 'qwen-vl' })
  })

  it('accepts an explicit sourceProvider override', async () => {
    const llm = fakeLlm(['deepseek', 'other'])
    const ctx = contextWith(llm, fakeDefaults())
    await ctx.plugin(Vision, { twinProvider: 'my-vision', sourceProvider: 'other' })
    expect(llm.registered[0]?.providers).toEqual(['my-vision'])
  })

  it('rejects when no source provider exists', async () => {
    const ctx = contextWith(fakeLlm([]), fakeDefaults())
    await expect(ctx.plugin(Vision, {})).rejects.toThrow(/no source provider/)
  })

  it('rejects an identical twin and source', async () => {
    const ctx = contextWith(fakeLlm(['deepseek']), fakeDefaults())
    await expect(ctx.plugin(Vision, { twinProvider: 'deepseek', sourceProvider: 'deepseek' })).rejects.toThrow(/must differ/)
  })
})