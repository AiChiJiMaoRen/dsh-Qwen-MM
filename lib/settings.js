// C:/Users/linha/dsh-plugins/dsh-qwen-mm/src/settings.ts
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
var SETTINGS_NS = settingsNamespace("dsh-qwen-mm");
var UPSTREAM_CONFIG_KEYS = [
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_BASE_URL",
  "QWEN_MM_API_VL_MODEL",
  "QWEN_MM_API_OMNI_MODEL",
  "QWEN_MM_SEARCH_BACKEND",
  "SERPER_API_KEY",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "BLENDER_BINARY",
  "BLENDER_HOST",
  "BLENDER_PORT",
  "FREECAD_BINARY",
  "FREECAD_RPC_HOST",
  "FREECAD_RPC_PORT"
];
var SETTINGS_SCHEMA = z.object({
  visionEnabled: z.boolean(),
  bridgeEnabled: z.boolean(),
  sourceProvider: z.string(),
  twinProvider: z.string(),
  exportDir: z.string(),
  workspaceDir: z.string(),
  ...Object.fromEntries(UPSTREAM_CONFIG_KEYS.map((key) => [key, z.string()]))
});
var SETTINGS_BASE = Object.freeze({ visionEnabled: true, bridgeEnabled: true });
function upstreamConfigPath() {
  const override = process.env.QWEN_MM_CONFIG;
  return override ? join(homedir(), override) : join(homedir(), ".qwen-mm-plugins", "config");
}
function parseUpstream(text) {
  const out = /* @__PURE__ */ new Map();
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim().replace(/^export\s+/, "");
    const value = line.slice(idx + 1).trim();
    if (key) out.set(key, value);
  }
  return out;
}
function syncUpstreamConfig(values) {
  const path = upstreamConfigPath();
  const merged = /* @__PURE__ */ new Map();
  try {
    for (const [k, v] of parseUpstream(readFileSync(path, "utf8"))) merged.set(k, v);
  } catch {
  }
  let dirty = false;
  for (const key of UPSTREAM_CONFIG_KEYS) {
    const value = typeof values[key] === "string" ? values[key] : void 0;
    if (value !== void 0 && value.trim() !== "") {
      const next = value.trim();
      if (merged.get(key) !== next) {
        merged.set(key, next);
        dirty = true;
      }
    }
  }
  if (!dirty) return;
  const body = "# qwen-mm-plugins config \u2014 KEY=VALUE per line, read when the var is not in the environment.\n\n" + [...merged.keys()].sort().map((k) => `${k}=${merged.get(k)}`).join("\n") + "\n";
  try {
    mkdirSync(join(homedir(), ".qwen-mm-plugins"), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, body, { encoding: "utf8", mode: 384 });
    try {
      chmodSync(tmp, 384);
    } catch {
    }
    writeFileSync(path, body, { encoding: "utf8", mode: 384 });
  } catch (error) {
    console.warn(`qwen-mm: could not write upstream config ${path}: ${String(error)}`);
  }
}
function installSettings(ctx) {
  let getSource;
  try {
    installSettingsSection(ctx, SETTINGS_NS, SETTINGS_SCHEMA, SETTINGS_BASE, {
      setSource: (fn) => {
        getSource = fn;
      },
      onChange: () => {
        try {
          syncUpstreamConfig(getSource?.() ?? {});
        } catch (error) {
          ctx.logger.warn(`qwen-mm: settings sync failed: ${String(error)}`);
        }
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
  UPSTREAM_CONFIG_KEYS,
  installSettings,
  readSettings,
  syncUpstreamConfig
};
