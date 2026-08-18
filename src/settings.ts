/**
 * dsh-qwen-mm settings namespace: the GUI-configurable surface for the twin
 * route, the attachment bridge, and the provider/directory overrides. The
 * server side registers the namespace so the host serves it; the browser
 * half renders it as a card under Settings → 插件 → 插件配置.
 *
 * @module @deepseek-ai/dsh-qwen-mm/settings
 */

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'

/** Settings namespace owned by this plugin (must match the client card's key). */
export const SETTINGS_NS: SettingsNamespace = settingsNamespace('dsh-qwen-mm')

/** GUI-tunable settings. Every field is optional; defaults apply in code. */
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
}

/** Config schema for the settings section. */
export const SETTINGS_SCHEMA: Schema<QwenMmSettings> = z.object({
  visionEnabled: z.boolean(),
  bridgeEnabled: z.boolean(),
  sourceProvider: z.string(),
  twinProvider: z.string(),
  exportDir: z.string(),
  workspaceDir: z.string(),
})

/** Composition defaults for the section (empty user layer inherits these). */
export const SETTINGS_BASE: QwenMmSettings = Object.freeze({
  visionEnabled: true,
  bridgeEnabled: true,
})

/** Register the section so the Settings → 插件 surface serves this namespace. */
export function installSettings(ctx: Context): void {
  try {
    installSettingsSection(ctx, SETTINGS_NS, SETTINGS_SCHEMA, SETTINGS_BASE, {
      setSource: () => {},
      onChange: () => {},
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