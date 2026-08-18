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
function installSettings(ctx) {
  try {
    installSettingsSection(ctx, SETTINGS_NS, SETTINGS_SCHEMA, SETTINGS_BASE, {
      setSource: () => {
      },
      onChange: () => {
      }
    });
  } catch (error) {
    ctx.logger.warn(`qwen-mm: could not install settings section "${SETTINGS_NS}": ${String(error)}`);
  }
}
function readSettings(ctx) {
  try {
    const value = ctx.settings?.get?.(SETTINGS_NS);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
export {
  SETTINGS_BASE,
  SETTINGS_NS,
  SETTINGS_SCHEMA,
  installSettings,
  readSettings
};
