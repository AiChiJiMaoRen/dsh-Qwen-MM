# dsh-qwen-mm

把 [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) 集成进官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh），让纯文本的 DeepSeek 模型也能"看懂"图片、视频、文档，并调用网络搜索、3D/CAD、视频剪辑等工具——**无需任何 harness 核心补丁，官方 0.1.0-rc.6 直接可装**。

> 实现背景：本仓库最初按 fork（含核心补丁的 deepseek-harness）开发；0.1.0 起改为**孪生路由 + 附件桥接**方案，用纯插件侧接口取代核心补丁，因此不再依赖 fork，也不受官方发版节奏绑架（版本配对见 [COMPAT.md](./COMPAT.md)）。

> **派生说明**：本仓库是 [RRRosmontis/dsh-qwen-mm](https://github.com/RRRosmontis/dsh-qwen-mm) 的**派生（Fork）**，MIT 许可，原作者署名与 LICENSE 保留。本分支在其基础上改造为**官方 dsh 0.1.0-rc.6 直接可用**：去掉对 fork 核心补丁的依赖（改用孪生路由 + 附件桥接），并加入严格版本守卫与 COMPAT 兼容矩阵。

## 它怎么工作

1. **孪生路由（`qwen-mm-vision`）**——把当前文本模型克隆注册为 `qwen-mm-vision` provider，声明支持图片并将它设为默认模型选择。于是 host 的图片准入闸放行拖图/粘贴，Web 输入框的图片按钮可用；但每个请求仍走原文本 provider（孪生只是"准入门面"）。
2. **附件桥接（`qwen-mm-attachments`）**——在 `agent/pre-step` 把每个图片块落盘到 `<dshHome>/qwen-mm/attachments/`，并在会话工作区 `<cwd>/qwen-mm/` 放一份副本，然后把图片块改写为路径引用 + system-reminder（点名 `mcp__qwen-mm-plugins-api__vision_chat` 与 `mcp__qwen-mm-plugins-core__read_image`）。**底层 API 永远不会收到图片字节。**
3. **能力层**——8 个 Qwen-MM-Plugins 能力以 SKILL + MCP server 形式注入，全部 pin 到不可变 release tag。

## 功能总览

| 能力 | 实现方式 | 需要密钥 |
|---|---|---|
| 读图 / 读视频 / 读文档 / 读数据 | `core` MCP 工具（`read_image`、`visualize`、`media_info` …） | ❌ 无 |
| 云端视觉 / OCR / ASR / 物体定位 | `api` MCP 工具（`vision_chat`、`ocr`、`omni_*` …） | ✅ DashScope |
| 网络搜索 + 以图搜图 | `search` MCP 工具（`web_search`、`web_extractor`、`image_search`） | ✅ Serper / Exa / Tavily |
| 长视频问答 / 视频剪辑 / Blender / FreeCAD / 数学视频 | `video-memory`、`video-edit`、`blender`、`freecad`、`edu-agent` | 按能力而定 |

## 安装（官方 0.1.0-rc.6）

```sh
dsh plugin --profile web add ./dsh-qwen-mm        # 或从 git/npm 安装
dsh --profile web                                  # 重启生效
```

装完打开新会话：模型选择器里会出现 **DeepSeek (Vision)**（`qwen-mm-vision`），默认已选中；直接拖图即可，模型会通过 MCP 工具读懂图片。

### 前置

- [`uv`](https://docs.astral.sh/uv/)：提供 `uvx`，MCP 服务器按需拉取（首次从 git 安装较慢）。
- `ffmpeg`：视频/音频类能力（`core` 读图不需要）。
- 系统程序按能力：Blender、FreeCAD、Node/Chromium（视频剪辑）、LibreOffice 等，缺了对应 MCP server 会连接失败但不影响其余能力。
- 插件启动时会检查 `uvx`/`ffmpeg` 是否存在，缺失只告警、不崩溃。

### 密钥

DSH 会过滤 MCP 子进程环境里的凭据类变量，请把密钥写进共享配置文件，而不是环境变量：

```sh
# 仅需配置一次（按提示选能力并填 key）
uvx --from 'qwen-mm-plugins[api] @ git+https://github.com/QwenLM/Qwen-MM-Plugins.git@qwen-mm-plugins-api-v1.0.2' qwen-mm-plugins-api configure
```

DashScope 开通：注册/登录阿里云 → [百炼控制台](https://bailian.console.aliyun.com) → 开通模型服务（新用户有免费额度）→ 创建 `sk-` 开头的 API Key → 填进上面的 configure 流程。

## 按需禁用能力

在 profile 的 `cordis.patch.yml` 里按 id 禁用，例如：

```yaml
- id: mcp-qwen-mm-blender
  disabled: true
- id: mcp-qwen-mm-freecad
  disabled: true
```

可禁用的 id：`mcp-qwen-mm-core/api/search/video-memory/video-edit/blender/freecad`，以及 `qwen-mm-attachments`、`qwen-mm-vision`。

## 目录结构

```
cordis.patch.yml      插件补丁层：skill 行 + 附件桥接行 + 孪生路由行 + 7 个 MCP 服务器行
lib/                  预构建运行时（index / invariant / attachments / vision）+ 类型声明
assets/skills/        内置的 Qwen-MM-Plugins SKILL.md 正文（固定到不可变 release tag）
src/                  TypeScript 源码
tests/                vitest 测试（bridge / vision / patch / loader）
COMPAT.md             与 dsh 版本的兼容矩阵与升级指引
```

## 内置内容与署名

`assets/skills/` 取自 Apache-2.0 协议的 [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) 仓库，固定在其不可变 release tag 上；上游保留其版权与许可证。MCP 命令在运行时从上游 git 仓库安装同一 tag 的发布版本。

## 许可

[MIT](./LICENSE)