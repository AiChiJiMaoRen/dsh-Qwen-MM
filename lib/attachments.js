// src/attachments.ts
import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import z2 from "@deepseek-ai/schemastery";

// src/settings.ts
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
var SETTINGS_NS = settingsNamespace("dsh-qwen-mm");
var SETTINGS_SCHEMA = z.object({
  visionEnabled: z.boolean(),
  bridgeEnabled: z.boolean(),
  sourceProvider: z.string(),
  twinProvider: z.string(),
  exportDir: z.string(),
  workspaceDir: z.string()
});
var SETTINGS_BASE = Object.freeze({
  visionEnabled: true,
  bridgeEnabled: true
});
function readSettings(ctx) {
  try {
    const value = ctx.settings?.get?.(SETTINGS_NS);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

// src/attachments.ts
var name = "qwen-mm-attachments";
var inject = ["attachments"];
var Config = z2.object({
  exportDir: z2.string(),
  workspaceDir: z2.string()
});
var MEDIA_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};
function exportFileName(ref) {
  const id = String(ref.attachmentId).replace(/^sha256:/, "");
  return `${id}.${MEDIA_EXT[ref.mediaType]}`;
}
async function exportImages(reader, exportDir, messages, signal) {
  const exported = [];
  const seen = /* @__PURE__ */ new Set();
  for (const message of messages) {
    for (const block of message.content) {
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
      exported.push({ id, path });
    }
  }
  return exported;
}
async function mirrorToWorkspace(exported, workspaceDir) {
  const mirrored = [];
  await mkdir(workspaceDir, { recursive: true });
  for (const file of exported) {
    const target = join(workspaceDir, basename(file.path));
    try {
      await access(target);
    } catch {
      await copyFile(file.path, target);
    }
    mirrored.push({ id: file.id, path: target });
  }
  return mirrored;
}
function workspaceRootFor(agent) {
  const header = agent.session.header;
  return header?.cwd;
}
function rewriteMessages(messages, pathById) {
  return messages.map((message) => {
    if (!message.content.some((block) => block.type === "image")) return message;
    const content = message.content.map((block) => {
      if (block.type !== "image") return block;
      const id = String(block.attachment.attachmentId).replace(/^sha256:/, "");
      const path = pathById.get(id);
      const text = { type: "text", text: `[Image attachment exported to: ${path ?? "<missing>"}]` };
      return text;
    });
    return createUserMessage({ content, source: message.source });
  });
}
function renderReminder(files) {
  return [
    "<system-reminder>",
    'Images in the user\'s latest message were exported to local files so the qwen-mm MCP tools can read them (the chat route itself is text-only). Understand a picture via cloud Qwen VL with `mcp__qwen-mm-plugins-api__vision_chat` (e.g. `images: ["<path>"]`), or read it locally with `mcp__qwen-mm-plugins-core__read_image` (`image_path: "<path>"`). Exported files:',
    ...files.map((file) => `- ${file.path}`),
    "</system-reminder>"
  ].join("\n");
}
function apply(ctx, config) {
  const settings = readSettings(ctx);
  if (settings.bridgeEnabled === false) {
    ctx.logger.info("qwen-mm-attachments: disabled via settings (dsh-qwen-mm.bridgeEnabled=false)");
    return;
  }
  const exportDir = config.exportDir ?? settings.exportDir ?? join(resolveDshHome(), "qwen-mm", "attachments");
  ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject") return decision;
    const exported = await exportImages(
      (ref, sig) => ctx.attachments.readImage(ref, sig),
      exportDir,
      messages,
      signal
    );
    if (exported.length === 0) return decision;
    const workspace = config.workspaceDir ?? settings.workspaceDir ?? workspaceRootFor(agent);
    const preferred = workspace === void 0 ? exported : await mirrorToWorkspace(exported, join(workspace, "qwen-mm"));
    const pathById = new Map(preferred.map((file) => [file.id, file.path]));
    const rewritten = rewriteMessages(decision.messages, pathById);
    const reminder = createUserMessage({
      content: [{ type: "text", text: renderReminder(preferred) }],
      source: { kind: "plugin", plugin: "qwen-mm" }
    });
    return { kind: "enter", messages: [...rewritten, reminder] };
  });
}
export {
  Config,
  apply,
  exportFileName,
  exportImages,
  inject,
  mirrorToWorkspace,
  name,
  renderReminder,
  rewriteMessages,
  workspaceRootFor
};
