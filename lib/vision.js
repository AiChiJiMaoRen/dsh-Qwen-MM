// src/vision.ts
import {
  LlmAdapter
} from "@deepseek-ai/dsh-llm";
import z2 from "@deepseek-ai/schemastery";

// src/settings.ts
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
var SETTINGS_NS = settingsNamespace("dsh-qwen-mm");
var SETTINGS_SCHEMA = z.object({
  visionEnabled: z.boolean(),
  bridgeEnabled: z.boolean(),
  sourceProvider: z.string(),
  twinProvider: z.string(),
  exportDir: z.string(),
  workspaceDir: z.string()
});
var SETTINGS_BASE = Object.freeze({
  visionEnabled: true,
  bridgeEnabled: true
});
function readSettings(ctx) {
  try {
    const value = ctx.settings?.get?.(SETTINGS_NS);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

// src/vision.ts
var name = "qwen-mm-vision";
var inject = ["llm", "agentDefaultModel"];
var Config = z2.object({
  twinProvider: z2.string(),
  sourceProvider: z2.string()
});
var DEFAULT_TWIN_PROVIDER = "qwen-mm-vision";
var TwinAdapter = class extends LlmAdapter {
  constructor(ctx, source, twin) {
    super();
    this.ctx = ctx;
    this.source = source;
    this.twin = twin;
  }
  ctx;
  source;
  twin;
  providerInfo(provider) {
    return { id: this.twin, name: "DeepSeek (Vision)" };
  }
  providerRetryPolicy() {
    return void 0;
  }
  async resolveModel(_provider, model) {
    return { provider: this.twin, id: model, name: model, inputModalities: ["text", "image"] };
  }
  stream(options) {
    return this.ctx.llm.stream({ ...options, provider: this.source });
  }
};
function detectSource(ctx, twin) {
  const providers = ctx.llm.listProviders();
  void twin;
  return providers.find((provider) => /deepseek/i.test(provider.id) && !/vision/i.test(provider.id))?.id ?? providers.find((provider) => !/vision/i.test(provider.id))?.id;
}
function apply(ctx, config) {
  const settings = readSettings(ctx);
  if (settings.visionEnabled === false) {
    ctx.logger.info("qwen-mm-vision: disabled via settings (dsh-qwen-mm.visionEnabled=false)");
    return;
  }
  const twin = settings.twinProvider ?? config.twinProvider ?? DEFAULT_TWIN_PROVIDER;
  const source = settings.sourceProvider ?? config.sourceProvider ?? detectSource(ctx, twin);
  if (source === void 0) {
    throw new Error("qwen-mm-vision: no source provider to clone \u2014 install a text provider (e.g. @deepseek-ai/dsh-llm-deepseek) first");
  }
  if (source === twin) {
    throw new Error(`qwen-mm-vision: sourceProvider "${source}" must differ from twinProvider "${twin}"`);
  }
  if (!ctx.llm.listProviders().some((provider) => provider.id === source)) {
    throw new Error(`qwen-mm-vision: source provider "${source}" has no registered adapter`);
  }
  const adapter = new TwinAdapter(ctx, source, twin);
  ctx.llm.registerAdapter([twin], adapter);
  ctx.logger.info(`qwen-mm-vision: twin provider "${twin}" registered, delegating to "${source}"`);
  const current = ctx.agentDefaultModel.currentSelection();
  if (current.provider === source) {
    void ctx.agentDefaultModel.saveSelection({ ...current, provider: twin }).then(
      () => ctx.logger.info(`qwen-mm-vision: default model selection switched to "${twin}"`),
      (error) => ctx.logger.warn(`qwen-mm-vision: could not switch the default model selection: ${String(error)}`)
    );
  }
  ctx.on("agent/request", async (payload, next) => {
    const proposed = await next();
    if (proposed?.provider === source) return { ...proposed, provider: twin };
    return proposed;
  });
}
export {
  Config,
  apply,
  inject,
  name
};
