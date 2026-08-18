// C:/Users/linha/dsh-plugins/dsh-qwen-mm/src/index.ts
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// C:/Users/linha/dsh-plugins/dsh-qwen-mm/src/skills.ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  BUNDLED_SKILL_RANK
} from "@deepseek-ai/dsh-skill";
var PROVIDER_NAME = "qwen-mm";
var ASSET_DIR = fileURLToPath(new URL("../assets/skills/", import.meta.url));
var RESOURCE_BASE = { kind: "directory", path: ASSET_DIR };
var INVOCATION = { modelInvocable: true, userInvocable: true };
var SKILL_ENTRIES = [
  {
    name: "qwen-mm-plugins-core",
    description: "Local MCP tools to read and visualize any file \u2014 images, video, documents, code, data, 3D, notebooks, and more \u2014 plus image tools for cropping, annotating, and extracting frames.",
    file: "qwen-mm-plugins-core.md"
  },
  {
    name: "qwen-mm-plugins-api",
    description: "Cloud MCP tools for understanding media, by model family. VL model: vision_chat (caption/VQA), ocr, grounding (detect/locate objects). Omni model (reads frames + audio together): timestamped captioning, ASR (plain / controllable / multi-speaker diarized), temporal grounding, event counting, music captioning. Plus transcribe_audio (ASR) and segmentation (SAM3). Use when a question about an image/video/audio needs an external model, not just local reading.",
    file: "qwen-mm-plugins-api.md"
  },
  {
    name: "qwen-mm-plugins-search",
    description: "Web search and page extraction MCP tools (Serper, Exa, or Tavily) plus Serper Lens reverse-image search for confirming facts \u2014 web_search (find facts), web_extractor (read a page in depth), image_search (reverse-search a frame to identify an entity). Use to verify anything you cannot confirm from the media alone.",
    file: "qwen-mm-plugins-search.md"
  },
  {
    name: "qwen-mm-plugins-video-memory",
    description: "Triggered for long videos (30+ minutes), whether a single file or a directory of multiple videos. Vision-language MCP tools designed for efficient reading and semantic analysis of long videos (30+ minutes), supporting memory construction and semantic search.",
    file: "qwen-mm-plugins-video-memory.md"
  },
  {
    name: "qwen-mm-plugins-video-edit",
    description: "Editing-director skill that OWNS every video task built from EXISTING REAL FOOTAGE the user supplies (vlog, montage, intro, recap, eating/travel/family edits, style replication, compositing, subtitles, voiceover, B-roll). When footage files are the input, use THIS skill first \u2014 not the generic hyperframes entry and not the general-video workflow: it contributes footage judgment (selection, pacing, beat-sync, sound, looks, per-scene design) and then hands the designed composition to the HyperFrames pipeline for assembly and rendering, so the two are complementary rather than alternatives. It enforces the taste contract, scene-loop assembly with a Scene Ledger, and evidence-based independent review via its own plan-gate and review-gate scripts. Only tasks with NO real footage at all (a motion graphic or promo invented from a brief) go straight to hyperframes. Governance scales by mode instead of confirming every step.",
    file: "qwen-mm-plugins-video-edit.md"
  },
  {
    name: "qwen-mm-plugins-blender",
    description: "Use whenever a task involves building or editing a 3D scene or asset in Blender \u2014 modeling, characters/people, architecture/interiors, terrain/landscapes, props, materials, lighting, or rendering. Covers discovering installed add-ons, using generators, importing and REFINING ready-made assets, and matching the result to the spec. Requires a running Blender instance with the blender-mcp addon (see Prerequisite).",
    file: "qwen-mm-plugins-blender.md"
  },
  {
    name: "qwen-mm-plugins-freecad",
    description: "Use whenever a task involves parametric CAD in FreeCAD \u2014 modeling parts and assemblies, editing object properties, technical drawings, importing/exporting STEP/STL/OBJ/DXF, PDF/Excel reports from a model, or finite-element (FEM/CalculiX) analysis. Requires a running FreeCAD instance with the FreeCADMCP addon (see Prerequisite).",
    file: "qwen-mm-plugins-freecad.md"
  },
  {
    name: "qwen-mm-plugins-edu-agent",
    description: 'Generate step-by-step math problem-solving tutorial videos in Chinese (Mandarin). Use when: (1) a user provides a math problem and wants an explanation video, (2) someone says "make a math tutorial", "explain this equation", "create a teaching video for this problem", "\u8BB2\u89E3\u8FD9\u9053\u9898", "\u751F\u6210\u89E3\u9898\u89C6\u9891", (3) the user wants a Chinese-language math lesson covering formulas, equations, or geometric figures, (4) the user shares a math problem in text or LaTeX and asks for a video walkthrough, (5) the input is an image_assets/ folder containing problem images \u2014 the skill will extract the problem via visual recognition, solve it, and generate a tutorial video. Teaching components are rendered as realistic objects (solid opaque panels, 3D cards, SVG figures) with a modern aurora mesh aesthetic.',
    file: "qwen-mm-plugins-edu-agent.md"
  }
];
function createCandidates() {
  return SKILL_ENTRIES.map((entry) => ({
    name: entry.name,
    description: entry.description,
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: "bundled",
    resourceBase: RESOURCE_BASE,
    rank: BUNDLED_SKILL_RANK,
    locator: new URL(`../assets/skills/${entry.file}`, import.meta.url)
  }));
}
var candidates = createCandidates();
var provider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve(candidates),
  async get(candidate) {
    const entry = SKILL_ENTRIES.find((skill) => skill.name === candidate.name);
    if (entry === void 0) return void 0;
    return {
      name: entry.name,
      description: entry.description,
      invocation: INVOCATION,
      provider: PROVIDER_NAME,
      source: "bundled",
      resourceBase: RESOURCE_BASE,
      content: await readFile(new URL(`../assets/skills/${entry.file}`, import.meta.url), "utf8")
    };
  }
};

// C:/Users/linha/dsh-plugins/dsh-qwen-mm/src/settings.ts
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
var SETTINGS_NS = settingsNamespace("dsh-qwen-mm");
var UPSTREAM_CONFIG_KEYS = [
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_BASE_URL",
  "QWEN_MM_API_VL_MODEL",
  "QWEN_MM_API_OMNI_MODEL",
  "QWEN_MM_SEARCH_BACKEND",
  "SERPER_API_KEY",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "BLENDER_BINARY",
  "BLENDER_HOST",
  "BLENDER_PORT",
  "FREECAD_BINARY",
  "FREECAD_RPC_HOST",
  "FREECAD_RPC_PORT"
];
var SETTINGS_SCHEMA = z.object({
  visionEnabled: z.boolean(),
  bridgeEnabled: z.boolean(),
  sourceProvider: z.string(),
  twinProvider: z.string(),
  exportDir: z.string(),
  workspaceDir: z.string(),
  ...Object.fromEntries(UPSTREAM_CONFIG_KEYS.map((key) => [key, z.string()]))
});
var SETTINGS_BASE = Object.freeze({ visionEnabled: true, bridgeEnabled: true });
function upstreamConfigPath() {
  const override = process.env.QWEN_MM_CONFIG;
  return override ? join(homedir(), override) : join(homedir(), ".qwen-mm-plugins", "config");
}
function parseUpstream(text) {
  const out = /* @__PURE__ */ new Map();
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim().replace(/^export\s+/, "");
    const value = line.slice(idx + 1).trim();
    if (key) out.set(key, value);
  }
  return out;
}
function syncUpstreamConfig(values) {
  const path = upstreamConfigPath();
  const merged = /* @__PURE__ */ new Map();
  try {
    for (const [k, v] of parseUpstream(readFileSync(path, "utf8"))) merged.set(k, v);
  } catch {
  }
  let dirty = false;
  for (const key of UPSTREAM_CONFIG_KEYS) {
    const value = typeof values[key] === "string" ? values[key] : void 0;
    if (value !== void 0 && value.trim() !== "") {
      const next = value.trim();
      if (merged.get(key) !== next) {
        merged.set(key, next);
        dirty = true;
      }
    }
  }
  if (!dirty) return;
  const body = "# qwen-mm-plugins config \u2014 KEY=VALUE per line, read when the var is not in the environment.\n\n" + [...merged.keys()].sort().map((k) => `${k}=${merged.get(k)}`).join("\n") + "\n";
  try {
    mkdirSync(join(homedir(), ".qwen-mm-plugins"), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, body, { encoding: "utf8", mode: 384 });
    try {
      chmodSync(tmp, 384);
    } catch {
    }
    writeFileSync(path, body, { encoding: "utf8", mode: 384 });
  } catch (error) {
    console.warn(`qwen-mm: could not write upstream config ${path}: ${String(error)}`);
  }
}
function installSettings(ctx) {
  let getSource;
  try {
    installSettingsSection(ctx, SETTINGS_NS, SETTINGS_SCHEMA, SETTINGS_BASE, {
      setSource: (fn) => {
        getSource = fn;
      },
      onChange: () => {
        try {
          syncUpstreamConfig(getSource?.() ?? {});
        } catch (error) {
          ctx.logger.warn(`qwen-mm: settings sync failed: ${String(error)}`);
        }
      }
    });
  } catch (error) {
    ctx.logger.warn(`qwen-mm: could not install settings section "${SETTINGS_NS}": ${String(error)}`);
  }
}

// C:/Users/linha/dsh-plugins/dsh-qwen-mm/src/index.ts
var name = "qwen-mm";
var inject = ["skills"];
var SUPPORTED_DSH_VERSIONS = ["0.1.0-rc.6", "0.1.0-rc.7"];
function detectDshVersion() {
  try {
    const require2 = createRequire(import.meta.url);
    return require2("@deepseek-ai/dsh-app-boot/package.json").version;
  } catch {
    return void 0;
  }
}
function warnIfMissing(ctx, binary, hint) {
  const result = spawnSync(binary, ["--version"], { stdio: "ignore", windowsHide: true });
  if (result.error !== void 0) {
    ctx.logger.warn(`qwen-mm: "${binary}" was not found on PATH (${hint}). Capabilities that depend on it will be unavailable.`);
  }
}
function apply(ctx) {
  const version = detectDshVersion();
  if (version === void 0) {
    ctx.logger.warn(`qwen-mm: could not detect the running dsh version; loading anyway (validated: ${SUPPORTED_DSH_VERSIONS.join(", ")}). See COMPAT.md.`);
  } else if (!SUPPORTED_DSH_VERSIONS.includes(version)) {
    ctx.logger.warn(`qwen-mm: dsh ${version} is not in the validated list (${SUPPORTED_DSH_VERSIONS.join(", ")}). Loading anyway \u2014 if anything breaks, check COMPAT.md for the pairing guide.`);
  } else {
    ctx.logger.info(`qwen-mm: dsh ${version} (validated)`);
  }
  warnIfMissing(ctx, "uvx", "install uv (https://docs.astral.sh/uv/) to enable the qwen-mm MCP servers");
  warnIfMissing(ctx, "ffmpeg", "install ffmpeg to enable video and audio capabilities");
  installSettings(ctx);
  ctx.skills.registerProvider(() => provider);
}
export {
  SUPPORTED_DSH_VERSIONS,
  apply,
  detectDshVersion,
  inject,
  name
};
