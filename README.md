# dsh-qwen-mm

把 [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) 集成进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，让纯文本的 DeepSeek 模型也能"看懂"图片、视频、文档，并调用网络搜索、3D/CAD 等工具。

> **自主实现说明**：本插件的架构调研、编码、测试、文档与真机验证，均由 **DeepSeek Harness（`dsh`）驱动 `deepseek-v4-flash` 模型自主完成**，全程无需人工编写脚手架。

---

## English

Make [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) multimodal-native by integrating [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins).

> **Autonomous implementation.** This plugin was designed and implemented end-to-end, without hand-written scaffolding, by **DeepSeek Harness (`dsh`) running the `deepseek-v4-flash` model** — architecture research, coding, tests, documentation, and live verification were all performed by the agent itself.

## 功能总览 / Capabilities

| 能力 | 实现方式 | 需要密钥 |
|---|---|---|
| 读图 / 读视频 / 读文档 / 读代码 / 读数据 | `core` MCP 工具（`read_image`、`visualize`、`media_info`、`read_video` …） | ❌ 无 |
| 云端视觉 / OCR / ASR / 物体定位 | `api` MCP 工具（`vision_chat`、`ocr`、`omni_*` …），基于 DashScope Qwen VL/Omni | ✅ DashScope |
| 网络搜索 + 以图搜图 | `search` MCP 工具（`web_search`、`web_extractor`、`image_search`） | ✅ Serper / Tavily / Exa |
| 长视频问答 / 视频剪辑 / Blender / FreeCAD / 数学视频 | `video-memory`、`video-edit`、`blender`、`freecad`、`edu-agent` | 按能力而定 |
| **拖图上传 → 纯文本模型读懂** | 下方"图片附件桥接" | ❌ 无（走 `vision_chat`） |

## 图片附件桥接

DeepSeek 模型是纯文本的，所以 Web 输入框的图片准入默认会拒绝上传。本插件用三段协作让拖图照样可用：

1. **`dsh-attachment` 图片消费方注册表** —— `registerImageIntakeConsumer()` / `hasImageIntakeConsumer()`（见随附的核心补丁），让 host 在有消费方注册时于纯文本路由上放行图片上传。
2. **`attachments` 桥接插件** —— 在 `agent/pre-step` 把每个图片块导出到 `<dshHome>/qwen-mm/attachments/<sha256>.<ext>`，并把消息改写为路径引用。
3. **使用指引** —— 提示模型通过 `mcp__qwen-mm-plugins-api__vision_chat`（云端 Qwen VL）或 `mcp__qwen-mm-plugins-core__read_image` 读取图片。

拖入图片 → 文件落盘 → 纯文本模型通过 MCP 读懂它。

## 安装 / Install

前置：[`uv`](https://docs.astral.sh/uv/)（提供 `uvx`）+ 一份 DeepSeek Harness 安装。

```sh
# 从 git 仓库安装（锁定 commit）
dsh plugin --profile web add github:you/dsh-qwen-mm#<sha>
# 或从本地目录安装
dsh plugin --profile web add ./dsh-qwen-mm
```

随后重启 `dsh --profile web` 并打开新会话。

### 密钥 / Credentials

DSH 会过滤 MCP 子进程环境里的凭据类变量，所以请把密钥写进共享配置文件，而不是环境变量：

```sh
curl -fsSL https://raw.githubusercontent.com/QwenLM/Qwen-MM-Plugins/main/install.sh | bash -s -- configure
```

`core` 无需密钥。`api`/`video-memory`/`video-edit`/`edu-agent` 需要 DashScope 密钥；`search` 需要 Serper、Exa 或 Tavily。视频工具需要 `ffmpeg`；Blender/FreeCAD/LibreOffice/Chromium 仅由调用它们的能力按需使用。

## 用法 / Usage

```text
@report.pdf    总结第 3 页并提取表格。
@meeting.mp4   转写这段会议并标注说话人与时间戳。
@place.jpg     识别这张照片的拍摄地点并在网上核实。
```

…或者直接把图片拖进输入框提问。

## 核心前置 / Core prerequisite

拖图功能依赖 DeepSeek Harness 核心的一小段改动（`AttachmentStore` 上的图片消费方注册表，由 host 图片准入闸查询）。它**尚未进入已发布版本**；请把 [`deepseek-harness-core.patch`](./deepseek-harness-core.patch) 应用到 DeepSeek Harness 源码，或把对应改动合并进上游。MCP 服务器与内置 skills 在官方发布版上即可工作，无需该补丁；只有拖图准入需要它。

## 目录结构 / Layout

```
cordis.patch.yml      插件补丁层：skill provider 行 + 图片桥接行 + 7 个 MCP 服务器行
lib/                  预构建运行时（index / invariant / attachments）+ 类型声明
assets/skills/        内置的 Qwen-MM-Plugins SKILL.md 正文（固定到不可变 release tag）
src/                  TypeScript 源码
tests/                vitest 测试（provider / patch / bridge / intake）
```

## 内置内容与署名 / Vendored content & attribution

`assets/skills/` 取自 Apache-2.0 协议的 [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) 仓库，固定在其不可变 release tag 上；上游保留其版权与许可证。MCP 命令在运行时从上游 git 仓库安装同一 tag 的发布版本。

## 许可证 / License

[MIT](./LICENSE)
