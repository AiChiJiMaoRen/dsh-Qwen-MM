/**
 * Qwen-MM image attachment bridge.
 *
 * The twin vision route (`qwen-mm-vision`) declares image input so the host
 * image-intake gate admits uploads, but the underlying DeepSeek API is
 * text-only — image blocks must never reach the wire. This bridge exports
 * every image block in the claimed messages to local files (a deterministic
 * content-addressed store under the dsh home, plus a copy inside the session
 * workspace), rewrites the blocks into path-reference text, and injects a
 * system reminder naming the qwen-mm MCP tools that read them
 * (`mcp__qwen-mm-plugins-api__vision_chat`,
 * `mcp__qwen-mm-plugins-core__read_image`).
 *
 * @module @deepseek-ai/dsh-qwen-mm/attachments
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type Schema from '@deepseek-ai/schemastery';
/** Cordis plugin name. */
export declare const name = "qwen-mm-attachments";
/** Service required by the bridge (the durable attachment seam). */
export declare const inject: string[];
/** Bridge configuration. */
export interface Config {
    /** Directory exported image files land in; defaults to `<dshHome>/qwen-mm/attachments`. */
    readonly exportDir?: string;
    /** Directory for the per-session workspace copy; defaults to `<sessionCwd>/qwen-mm`. */
    readonly workspaceDir?: string;
}
/** Config schema for the loader; an omitted value falls back at apply time. */
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
 * Mirror already-exported files into a workspace directory (used so the model
 * can reach the copy through both MCP tools and ordinary file tools). Files
 * that already exist there are skipped; the returned list points at the
 * workspace copies.
 * @param exported - the files written to the export store.
 * @param workspaceDir - destination directory; created on first write.
 * @returns the mirrored files (same ids, workspace paths).
 */
export declare function mirrorToWorkspace(exported: readonly ExportedImage[], workspaceDir: string): Promise<ExportedImage[]>;
/** The session's workspace root, or undefined when the session carries no cwd. */
export declare function workspaceRootFor(agent: Agent): string | undefined;
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
 * @param files - the exported image files (workspace copies preferred).
 * @returns the verbatim `<system-reminder>` body.
 */
export declare function renderReminder(files: readonly ExportedImage[]): string;
/** Register the attachment bridge: export images, copy them into the workspace, and rewrite image blocks. */
export declare function apply(ctx: Context, config: Config): void;
