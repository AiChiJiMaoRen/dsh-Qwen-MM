/**
 * dsh-qwen-mm settings namespace: the GUI-configurable surface for the twin
 * route, the attachment bridge, and the provider/directory overrides. The
 * server side registers the namespace so the host serves it; the browser
 * half renders it as a card under Settings → 插件 → 插件配置.
 *
 * @module @deepseek-ai/dsh-qwen-mm/settings
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings';
import type Schema from '@deepseek-ai/schemastery';
/** Settings namespace owned by this plugin (must match the client card's key). */
export declare const SETTINGS_NS: SettingsNamespace;
/** GUI-tunable settings. Every field is optional; defaults apply in code. */
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
}
/** Config schema for the settings section. */
export declare const SETTINGS_SCHEMA: Schema<QwenMmSettings>;
/** Composition defaults for the section (empty user layer inherits these). */
export declare const SETTINGS_BASE: QwenMmSettings;
/** Register the section so the Settings → 插件 surface serves this namespace. */
export declare function installSettings(ctx: Context): void;
/** Read the resolved settings (schema defaults applied) or an empty object. */
export declare function readSettings(ctx: Context): QwenMmSettings;
