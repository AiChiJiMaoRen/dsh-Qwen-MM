/**
 * Qwen-MM-Plugins integration bundle plugin: registers the bundled skill
 * provider on `ctx.skills` and guards the composition against unsupported
 * DeepSeek Harness versions. The MCP server rows and the twin vision route
 * live in the bundle patch (`cordis.patch.yml`).
 *
 * @module @deepseek-ai/dsh-qwen-mm
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name. */
export declare const name = "qwen-mm";
/** Service required by the bundled provider. */
export declare const inject: string[];
/** dsh releases this build has been validated against (advisory, not blocking). */
export declare const SUPPORTED_DSH_VERSIONS: readonly string[];
/** Read the running harness version from the harmonized app-boot package. */
export declare function detectDshVersion(): string | undefined;
/** Register the bundled skill provider and guard the runtime environment. */
export declare function apply(ctx: Context): void;
