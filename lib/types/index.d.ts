/**
 * Qwen-MM-Plugins integration bundle plugin: registers the bundled skill
 * provider on `ctx.skills`. The MCP server rows live in the bundle patch and
 * mount through `@deepseek-ai/dsh-mcp-client`.
 *
 * @module @deepseek-ai/dsh-qwen-mm
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name. */
export declare const name = "qwen-mm";
/** Service required by the bundled provider. */
export declare const inject: string[];
/** Register the bundled Qwen-MM-Plugins skill provider on `ctx.skills`. */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map