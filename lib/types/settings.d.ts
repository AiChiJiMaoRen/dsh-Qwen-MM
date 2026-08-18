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
import type { Context } from '@deepseek-ai/cordis';
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings';
import type Schema from '@deepseek-ai/schemastery';
/** Settings namespace owned by this plugin (must match the client card's key). */
export declare const SETTINGS_NS: SettingsNamespace;
/** Upstream capability config keys manageable from this card. */
export declare const UPSTREAM_CONFIG_KEYS: readonly string[];
/** GUI-tunable settings (toggles + upstream credential/endpoint overrides). */
export interface QwenMmSettings {
    /** Enable the qwen-mm-vision twin route (image admission). */
    readonly visionEnabled?: boolean;
    /** Enable the qwen-mm-attachments bridge (export + rewrite image blocks). */
    readonly bridgeEnabled?: boolean;
    /** Provider whose model route the twin clones. */
    readonly sourceProvider?: string;
    /** Provider id the twin is registered under. */
    readonly twinProvider?: string;
    /** Directory exported image files land in. */
    readonly exportDir?: string;
    /** Workspace root for the per-session copy (<root>/qwen-mm). */
    readonly workspaceDir?: string;
    /** Upstream capability credential/endpoint overrides (written to ~/.qwen-mm-plugins/config). */
    readonly [key: string]: boolean | string | undefined;
}
/** Config schema for the settings section. */
export declare const SETTINGS_SCHEMA: Schema<QwenMmSettings>;
/** Composition defaults for the section (empty user layer inherits these). */
export declare const SETTINGS_BASE: QwenMmSettings;
/**
 * Mirror the manageable upstream keys into ~/.qwen-mm-plugins/config, keeping
 * every other key already present (the union of what `configure`/`--setup`
 * wrote and what the card manages). A key with an empty string is removed.
 * File is written atomically with 0600 perms (mode is advisory on Windows).
 */
export declare function syncUpstreamConfig(values: QwenMmSettings): void;
/** Register the section and mirror the manageable keys to the upstream config file. */
export declare function installSettings(ctx: Context): void;
/** Read the resolved settings (schema defaults applied) or an empty object. */
export declare function readSettings(ctx: Context): QwenMmSettings;
