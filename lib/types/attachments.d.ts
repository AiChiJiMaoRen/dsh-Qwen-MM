/**
 * Qwen-MM image attachment bridge: exports user-attached images to local
 * files and, on text-only model routes, rewrites the image blocks into
 * path-reference text so the model can read them through the qwen-mm MCP
 * tools (`mcp__qwen-mm-plugins-api__vision_chat`,
 * `mcp__qwen-mm-plugins-core__read_image`). Image-capable routes keep the
 * blocks untouched and read them natively.
 *
 * @module @deepseek-ai/dsh-qwen-mm/attachments
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type Schema from '@deepseek-ai/schemastery';
/** Cordis plugin name. */
export declare const name = "qwen-mm-attachments";
/** Services required by the bridge. */
export declare const inject: string[];
/** Bridge configuration. */
export interface Config {
    /** Directory exported image files land in; defaults to `<dshHome>/qwen-mm/attachments`. */
    readonly exportDir?: string;
}
/** Config schema for the loader; an omitted `exportDir` falls back to `<dshHome>/qwen-mm/attachments`. */
export declare const Config: Schema<Config>;
/** One exported image file. */
export interface ExportedImage {
    /** Content-addressed attachment id with any `sha256:` scheme stripped. */
    readonly id: string;
    /** Absolute path of the exported file. */
    readonly path: string;
}
/** Bytes reader abstraction, kept separate so tests can inject a fake. */
export type ImageReader = (ref: ImageAttachmentRef, signal: AbortSignal) => Promise<{
    readonly data: Uint8Array;
}>;
/**
 * Deterministic on-disk name for one attachment: `<sha256-hex>.<ext>`.
 * Content addressing makes the name stable, so re-exporting the same image
 * is idempotent and never duplicates a file.
 * @param ref - the durable image reference.
 * @returns the file name for the exported copy.
 */
export declare function exportFileName(ref: ImageAttachmentRef): string;
/**
 * Export every image block in the messages to `exportDir`, returning the
 * exported files in first-seen order. Existing files are skipped (idempotent
 * by content addressing).
 * @param reader - reads one attachment's verified bytes.
 * @param exportDir - destination directory; created on first write.
 * @param messages - the claimed user messages scanned for image blocks.
 * @param signal - the current step's abort signal.
 * @returns the exported files, one per unique image block.
 */
export declare function exportImages(reader: ImageReader, exportDir: string, messages: readonly UserMessage[], signal: AbortSignal): Promise<ExportedImage[]>;
/**
 * Rewrite messages, replacing each image block with a text block naming its
 * exported path, so a text-only route never receives an image block.
 * @param messages - the messages to rewrite.
 * @param pathById - exported path per stripped attachment id.
 * @returns rewritten copies for messages that contained images; other
 *   messages pass through unchanged.
 */
export declare function rewriteMessages(messages: readonly UserMessage[], pathById: ReadonlyMap<string, string>): UserMessage[];
/**
 * Render the injected guidance reminder naming the exported files and the
 * qwen-mm MCP tools that read them.
 * @param files - the exported image files.
 * @returns the verbatim `<system-reminder>` body.
 */
export declare function renderReminder(files: readonly ExportedImage[]): string;
/**
 * Whether the agent's route declares image input. An unresolvable route is
 * treated as text-only so the bridge still exports and rewrites.
 * @param llm - the LLM service resolving route metadata.
 * @param agent - the agent whose route is inspected.
 * @param signal - the current step's abort signal.
 * @returns true when the route declares `image` input modality.
 */
export declare function routeSupportsImage(llm: LlmRuntime, agent: Agent, signal: AbortSignal): Promise<boolean>;
/** Register the attachment bridge: export images and rewrite them on text-only routes. */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=attachments.d.ts.map