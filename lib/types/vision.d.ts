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
import type { Context } from '@deepseek-ai/cordis';
import type Schema from '@deepseek-ai/schemastery';
/** Cordis plugin name. */
export declare const name = "qwen-mm-vision";
/** Services required by the twin route. */
export declare const inject: string[];
/** Twin-route configuration. */
export interface Config {
    /** Provider id the twin is registered under. */
    readonly twinProvider?: string;
    /** Provider id whose model route the twin clones. Omitted: auto-detected. */
    readonly sourceProvider?: string;
}
/** Config schema for the loader; an omitted value falls back at apply time. */
export declare const Config: Schema<Config>;
/** Register the twin route and steer the default selection toward it. */
export declare function apply(ctx: Context, config: Config): void;
