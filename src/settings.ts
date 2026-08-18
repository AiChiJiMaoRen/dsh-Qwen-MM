/**
 * dsh-qwen-mm settings namespace:
 *
 * 1. Behavior toggles for the twin route / attachment bridge (read by the
 *    vision and attachments rows).
 * 2. Qwen-MM-Plugins capability credentials & endpoints (DashScope, search
 *    providers, Blender/FreeCAD hosts) — the GUI card edits these, and on
 *    every save the values are mirrored to `~/.qwen-mm-plugins/config`, the
 *    KEY=VALUE file the MCP servers actually read (dsh strips credential env
 *    vars from MCP child processes, so the file is the authority).
 *
 * @module @deepseek-ai/dsh-qwen-mm/settings
 */

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'

/** Settings namespace owned by this plugin (must match the client card's key). */
export const SETTINGS_NS: SettingsNamespace = settingsNamespace('dsh-qwen-mm')

/** Upstream capability config keys manageable from this card. */
export const UPSTREAM_CONFIG_KEYS: readonly string[] = [
  'DASHSCOPE_API_KEY',
  'DASHSCOPE_BASE_URL',
  'QWEN_MM_API_VL_MODEL',
  'QWEN_MM_API_OMNI_MODEL',
  'QWEN_MM_SEARCH_BACKEND',
  'SERPER_API_KEY',
  'TAVILY_API_KEY',
  'EXA_API_KEY',
  'BLENDER_BINARY',
  'BLENDER_HOST',
  'BLENDER_PORT',
  'FREECAD_BINARY',
  'FREECAD_RPC_HOST',
  'FREECAD_RPC_PORT',
]

/** GUI-tunable settings (toggles + upstream credential/endpoint overrides). */
export interface QwenMmSettings {
  /** Enable the qwen-mm-vision twin route (image admission). */
  readonly visionEnabled?: boolean
  /** Enable the qwen-mm-attachments bridge (export + rewrite image blocks). */
  readonly bridgeEnabled?: boolean
  /** Provider whose model route the twin clones. */
  readonly sourceProvider?: string
  /** Provider id the twin is registered under. */
  readonly twinProvider?: string
  /** Directory exported image files land in. */
  readonly exportDir?: string
  /** Workspace root for the per-session copy (<root>/qwen-mm). */
  readonly workspaceDir?: string
  /** Upstream capability credential/endpoint overrides (written to ~/.qwen-mm-plugins/config). */
  readonly [key: string]: boolean | string | undefined
}

/** Config schema for the settings section. */
export const SETTINGS_SCHEMA: Schema<QwenMmSettings> = z.object({
  visionEnabled: z.boolean(),
  bridgeEnabled: z.boolean(),
  sourceProvider: z.string(),
  twinProvider: z.string(),
  exportDir: z.string(),
  workspaceDir: z.string(),
  ...Object.fromEntries(UPSTREAM_CONFIG_KEYS.map(key => [key, z.string()])),
})

/** Composition defaults for the section (empty user layer inherits these). */
export const SETTINGS_BASE: QwenMmSettings = Object.freeze({ visionEnabled: true, bridgeEnabled: true })

/** Path of the upstream Qwen-MM-Plugins config file (honors QWEN_MM_CONFIG). */
function upstreamConfigPath(): string {
  const override = process.env.QWEN_MM_CONFIG
  return override ? join(homedir(), override) : join(homedir(), '.qwen-mm-plugins', 'config')
}

/** Parse an upstream KEY=VALUE config file into a map (custom dotenv-ish). */
function parseUpstream(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (let line of text.split(/\r?\n/)) {
    line = line.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const idx = line.indexOf('=')
    const key = line.slice(0, idx).trim().replace(/^export\s+/, '')
    const value = line.slice(idx + 1).trim()
    if (key) out.set(key, value)
  }
  return out
}

/**
 * Mirror the manageable upstream keys into ~/.qwen-mm-plugins/config, keeping
 * every other key already present. This sync is WRITE-ONLY: a key is written
 * only when the settings document carries a non-empty string; empty/absent
 * keys leave the file untouched (clearing is left to the upstream `--unset` /
 * editing the file directly), so the host can never wipe credentials that
 * were configured by other means. File is written atomically with 0600.
 */
export function syncUpstreamConfig(values: QwenMmSettings): void {
  const path = upstreamConfigPath()
  const merged = new Map<string, string>()
  try {
    for (const [k, v] of parseUpstream(readFileSync(path, 'utf8'))) merged.set(k, v)
  } catch {
    /* file missing — start fresh */
  }
  let dirty = false
  for (const key of UPSTREAM_CONFIG_KEYS) {
    const value = typeof values[key] === 'string' ? values[key]! : undefined
    if (value !== undefined && value.trim() !== '') {
      const next = value.trim()
      if (merged.get(key) !== next) { merged.set(key, next); dirty = true }
    }
  }
  if (!dirty) return
  const body = '# qwen-mm-plugins config — KEY=VALUE per line, read when the var is not in the environment.\n\n'
    + [...merged.keys()].sort().map(k => `${k}=${merged.get(k)}`).join('\n') + '\n'
  try {
    mkdirSync(join(homedir(), '.qwen-mm-plugins'), { recursive: true })
    const tmp = `${path}.tmp`
    writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 })
    try { chmodSync(tmp, 0o600) } catch { /* Windows: advisory */ }
    writeFileSync(path, body, { encoding: 'utf8', mode: 0o600 })
  } catch (error) {
    // Never let a config write take the plugin down.
    console.warn(`qwen-mm: could not write upstream config ${path}: ${String(error)}`)
  }
}

/** Register the section and mirror the manageable keys to the upstream config file. */
export function installSettings(ctx: Context): void {
  let getSource: (() => QwenMmSettings) | undefined
  try {
    installSettingsSection(ctx, SETTINGS_NS, SETTINGS_SCHEMA, SETTINGS_BASE, {
      setSource: (fn) => { getSource = fn },
      onChange: () => {
        try {
          syncUpstreamConfig((getSource?.() ?? {}) as QwenMmSettings)
        } catch (error) {
          ctx.logger.warn(`qwen-mm: settings sync failed: ${String(error)}`)
        }
      },
    })
  } catch (error) {
    ctx.logger.warn(`qwen-mm: could not install settings section "${SETTINGS_NS}": ${String(error)}`)
  }
}

/** Read the resolved settings (schema defaults applied) or an empty object. */
export function readSettings(ctx: Context): QwenMmSettings {
  try {
    const value = ctx.settings?.get?.(SETTINGS_NS)
    return value && typeof value === 'object' ? (value as QwenMmSettings) : {}
  } catch {
    return {}
  }
}