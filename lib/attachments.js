import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import z from "@deepseek-ai/schemastery";
//#region lib/types/attachments.js
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
/** Cordis plugin name. */
const name = "qwen-mm-attachments";
/** Services required by the bridge. */
const inject = [
	"attachments",
	"agents",
	"llm"
];
/** Config schema for the loader; an omitted `exportDir` falls back to `<dshHome>/qwen-mm/attachments`. */
const Config = z.object({ exportDir: z.string() });
const MEDIA_EXT = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif": "gif"
};
/**
* Deterministic on-disk name for one attachment: `<sha256-hex>.<ext>`.
* Content addressing makes the name stable, so re-exporting the same image
* is idempotent and never duplicates a file.
* @param ref - the durable image reference.
* @returns the file name for the exported copy.
*/
function exportFileName(ref) {
	return `${String(ref.attachmentId).replace(/^sha256:/, "")}.${MEDIA_EXT[ref.mediaType]}`;
}
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
async function exportImages(reader, exportDir, messages, signal) {
	const exported = [];
	const seen = /* @__PURE__ */ new Set();
	for (const message of messages) for (const block of message.content) {
		if (block.type !== "image") continue;
		const id = String(block.attachment.attachmentId).replace(/^sha256:/, "");
		if (seen.has(id)) continue;
		seen.add(id);
		const path = join(exportDir, exportFileName(block.attachment));
		try {
			await access(path);
		} catch {
			const { data } = await reader(block.attachment, signal);
			signal.throwIfAborted();
			await mkdir(exportDir, { recursive: true });
			await writeFile(path, data, { flag: "wx" });
		}
		exported.push({
			id,
			path
		});
	}
	return exported;
}
/**
* Rewrite messages, replacing each image block with a text block naming its
* exported path, so a text-only route never receives an image block.
* @param messages - the messages to rewrite.
* @param pathById - exported path per stripped attachment id.
* @returns rewritten copies for messages that contained images; other
*   messages pass through unchanged.
*/
function rewriteMessages(messages, pathById) {
	return messages.map((message) => {
		if (!message.content.some((block) => block.type === "image")) return message;
		return createUserMessage({
			content: message.content.map((block) => {
				if (block.type !== "image") return block;
				const id = String(block.attachment.attachmentId).replace(/^sha256:/, "");
				return {
					type: "text",
					text: `[Image attachment exported to: ${pathById.get(id) ?? "<missing>"}]`
				};
			}),
			source: message.source
		});
	});
}
/**
* Render the injected guidance reminder naming the exported files and the
* qwen-mm MCP tools that read them.
* @param files - the exported image files.
* @returns the verbatim `<system-reminder>` body.
*/
function renderReminder(files) {
	return [
		"<system-reminder>",
		"Images in the user's latest message were exported to local files because the active model route is text-only. Read them through the qwen-mm MCP tools: call `mcp__qwen-mm-plugins-api__vision_chat` with `images: [\"<path>\"]` to understand a picture via cloud Qwen VL, or `mcp__qwen-mm-plugins-core__read_image` with `image_path: \"<path>\"` for local reading. Exported files:",
		...files.map((file) => `- ${file.path}`),
		"</system-reminder>"
	].join("\n");
}
/**
* Whether the agent's route declares image input. An unresolvable route is
* treated as text-only so the bridge still exports and rewrites.
* @param llm - the LLM service resolving route metadata.
* @param agent - the agent whose route is inspected.
* @param signal - the current step's abort signal.
* @returns true when the route declares `image` input modality.
*/
async function routeSupportsImage(llm, agent, signal) {
	const header = agent.session.requestHeader();
	const provider = header?.config.provider ?? agent.options.provider;
	const model = header?.config.model ?? agent.options.model;
	if (provider === void 0 || model === void 0) return false;
	try {
		return (await llm.resolveModelInfo(provider, model, signal)).inputModalities?.includes("image") ?? false;
	} catch {
		return false;
	}
}
/** Register the attachment bridge: export images and rewrite them on text-only routes. */
function apply(ctx, config) {
	const exportDir = config.exportDir ?? join(resolveDshHome(), "qwen-mm", "attachments");
	ctx.effect(() => ctx.attachments.registerImageIntakeConsumer(name));
	ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
		const decision = await next();
		if (decision.kind === "reject") return decision;
		if (await routeSupportsImage(ctx.llm, agent, signal)) return decision;
		const exported = await exportImages((ref, sig) => ctx.attachments.readImage(ref, sig), exportDir, messages, signal);
		if (exported.length === 0) return decision;
		const pathById = new Map(exported.map((file) => [file.id, file.path]));
		const rewritten = rewriteMessages(decision.messages, pathById);
		const reminder = createUserMessage({
			content: [{
				type: "text",
				text: renderReminder(exported)
			}],
			source: {
				kind: "plugin",
				plugin: "qwen-mm"
			}
		});
		return {
			kind: "enter",
			messages: [...rewritten, reminder]
		};
	});
}
//#endregion
export { Config, apply, exportFileName, exportImages, inject, name, renderReminder, rewriteMessages, routeSupportsImage };
