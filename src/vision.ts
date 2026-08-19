/**
 * Qwen-MM vision twin route.
 *
 * The DeepSeek chat models the harness runs are text-only: the host
 * image-intake gate rejects uploads to a route whose model does not declare
 * `image` input, and the model API itself cannot receive image blocks. This
 * plugin registers a twin provider (`qwen-mm-vision`) that clones the source
 * provider's route but *declares* image input, then steers the default model
 * selection (and per-step request configs) toward the twin, so the gate
 * admits uploads. Every request still streams through the original text-only
 * provider — the twin is an admission facade only, and the attachment bridge
 * rewrites image blocks into local path references at `agent/pre-step` time,
 * so the underlying API never receives image bytes.
 *
 * @module @deepseek-ai/dsh-qwen-mm/vision
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import {
  LlmAdapter,
  type GenerateOptions,
  type LlmCallConfig,
  type LlmModelInfo,
  type LlmProviderInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { readSettings } from './settings.ts'

/** Cordis plugin name. */
export const name = 'qwen-mm-vision'
/** Services required by the twin route. */
export const inject = ['llm', 'agentDefaultModel']

/** Twin-route configuration. */
export interface Config {
  /** Provider id the twin is registered under. */
  readonly twinProvider?: string
  /** Provider id whose model route the twin clones. Omitted: auto-detected. */
  readonly sourceProvider?: string
}

/** Config schema for the loader; an omitted value falls back at apply time. */
export const Config: Schema<Config> = z.object({
  twinProvider: z.string(),
  sourceProvider: z.string(),
})

const DEFAULT_TWIN_PROVIDER = 'qwen-mm-vision'

/** Adapter that clones one source provider under the twin id while declaring image input. */
class TwinAdapter extends LlmAdapter {
  constructor(
    private readonly ctx: Context,
    private readonly source: string,
    private readonly twin: string,
  ) {
    super()
  }

  providerInfo(provider: string): LlmProviderInfo {
    return { id: this.twin, name: 'DeepSeek (Vision)' }
  }

  providerRetryPolicy(): undefined {
    return undefined
  }

  listModels(): Promise<readonly LlmModelInfo[]> {
    // Mirror the source provider's advertised models so the twin shows up in
    // the model selector with the same option set (e.g. deepseek-v4-flash),
    // rebranding each under the twin provider id (listModels validates that
    // every returned model.provider equals the queried provider).
    return this.ctx.llm.listModels(this.source).then(models =>
      models.map(m => ({ ...m, provider: this.twin }))
    )
  }

  async resolveModel(_provider: string, model: string): Promise<LlmResolvedModelInfo> {
    let src: LlmResolvedModelInfo | null
    try { src = await this.ctx.llm.resolveModelInfo(this.source, model) } catch { src = null }
    // Mirror the source model's full metadata (reasoning efforts, context,
    // max tokens) so capabilities like reasoning effort "max" stay supported,
    // while overriding the input modalities to advertise image input.
    return {
      provider: this.twin,
      id: model,
      name: src?.name ?? model,
      ...(src?.context === undefined ? {} : { context: src.context }),
      ...(src?.reasoning === undefined ? {} : { reasoning: src.reasoning }),
      ...(src?.defaultMaxTokens === undefined ? {} : { defaultMaxTokens: src.defaultMaxTokens }),
      inputModalities: ['text', 'image'],
    }
  }

  stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // Delegate the wire call to the real, text-only provider under its own
    // id. The twin never streams image payloads itself, so no text-only API
    // constraint is violated.
    return this.ctx.llm.stream({ ...options, provider: this.source })
  }
}

/** Pick the source provider to clone: the harness's DeepSeek text route first, else any other. */
function detectSource(ctx: Context, twin: string): string | undefined {
  const providers = ctx.llm.listProviders()
  void twin
  return (
    providers.find(provider => /deepseek/i.test(provider.id) && !/vision/i.test(provider.id))?.id ??
    providers.find(provider => !/vision/i.test(provider.id))?.id
  )
}

/** Register the twin route and steer the default selection toward it. */
export function apply(ctx: Context, config: Config): void {
  const settings = readSettings(ctx)
  if (settings.visionEnabled === false) {
    ctx.logger.info('qwen-mm-vision: disabled via settings (dsh-qwen-mm.visionEnabled=false)')
    return
  }
  const twin = settings.twinProvider ?? config.twinProvider ?? DEFAULT_TWIN_PROVIDER
  const source = settings.sourceProvider ?? config.sourceProvider ?? detectSource(ctx, twin)
  if (source === undefined) {
    throw new Error('qwen-mm-vision: no source provider to clone — install a text provider (e.g. @deepseek-ai/dsh-llm-deepseek) first')
  }
  if (source === twin) {
    throw new Error(`qwen-mm-vision: sourceProvider "${source}" must differ from twinProvider "${twin}"`)
  }
  if (!ctx.llm.listProviders().some(provider => provider.id === source)) {
    ctx.logger.warn(`qwen-mm-vision: source provider "${source}" has no registered adapter — vision twin disabled`)
    return
  }

  const adapter = new TwinAdapter(ctx, source, twin)
  ctx.llm.registerAdapter([twin], adapter)
  ctx.logger.info(`qwen-mm-vision: twin provider "${twin}" registered, delegating to "${source}"`)

  // Make the twin the default selection only when the saved default already
  // points at the source text route; an explicit default on another provider
  // is left untouched (the user can still pick the twin in the selector).
  const current = ctx.agentDefaultModel.currentSelection()
  if (current.provider === source) {
    void ctx.agentDefaultModel.saveSelection({ ...current, provider: twin }).then(
      () => ctx.logger.info(`qwen-mm-vision: default model selection switched to "${twin}"`),
      (error: unknown) => ctx.logger.warn(`qwen-mm-vision: could not switch the default model selection: ${String(error)}`),
    )
  }

  // Steering: any step that would run on the source route logs a twin header,
  // which converges resumed sessions' selection to the twin after one message
  // (the admission gate reads the session selection, not the request config).
  ctx.on('agent/request', async (payload, next): Promise<LlmCallConfig> => {
    const proposed = await next()
    if (proposed?.provider === source) return { ...proposed, provider: twin }
    return proposed
  })
}