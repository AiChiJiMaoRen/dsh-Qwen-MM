/* dsh-qwen-mm — browser half: a configurable-plugin card under Settings → 插件
 * → 插件配置 (slot `settings.plugin.item`, keyed by the settings namespace
 * `dsh-qwen-mm`). The card edits Qwen-MM-Plugins capability credentials &
 * endpoints (mirrored to ~/.qwen-mm-plugins/config by the host row) plus the
 * twin/bridge behavior toggles.
 */
window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-qwen-mm/client",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const react = require("react");
    const { createElement: h, useState } = react;
    const { createSnapshotStore } = require("@deepseek-ai/dsh-client-runtime/client");

    const NS = "dsh-qwen-mm";

    // Fields: kind text (string) or bool; label/hint keys resolved via t().
    const FIELDS = [
      { field: "DASHSCOPE_API_KEY", kind: "text" },
      { field: "DASHSCOPE_BASE_URL", kind: "text" },
      { field: "QWEN_MM_API_VL_MODEL", kind: "text" },
      { field: "QWEN_MM_API_OMNI_MODEL", kind: "text" },
      { field: "QWEN_MM_SEARCH_BACKEND", kind: "text" },
      { field: "SERPER_API_KEY", kind: "text" },
      { field: "TAVILY_API_KEY", kind: "text" },
      { field: "EXA_API_KEY", kind: "text" },
      { field: "BLENDER_BINARY", kind: "text" },
      { field: "BLENDER_PORT", kind: "text" },
      { field: "FREECAD_BINARY", kind: "text" },
      { field: "FREECAD_RPC_PORT", kind: "text" },
      { field: "visionEnabled", kind: "bool" },
      { field: "bridgeEnabled", kind: "bool" },
    ];
    const FIELD_NAMES = FIELDS.map((f) => f.field);

    const zh = {
      title: "Qwen 多模态（能力配置）",
      description: "DashScope/搜索等能力凭据与端点（保存后同步到 ~/.qwen-mm-plugins/config，能力服务器重启后生效）；下方还有孪生/桥接开关。",
      DASHSCOPE_API_KEY: "DashScope API Key",
      DASHSCOPE_API_KEYHint: "api/video-memory/video-edit/edu-agent 使用；写进上游配置文件。",
      DASHSCOPE_BASE_URL: "DashScope 接口地址",
      DASHSCOPE_BASE_URLHint: "留空用官方默认；自建/代理填 OpenAI 兼容 URL。",
      QWEN_MM_API_VL_MODEL: "VL 模型（vision_chat/OCR/grounding）",
      QWEN_MM_API_OMNI_MODEL: "Omni 模型（音视频理解）",
      QWEN_MM_SEARCH_BACKEND: "搜索后端",
      QWEN_MM_SEARCH_BACKENDHint: "auto / serper / tavily / exa。",
      SERPER_API_KEY: "Serper API Key",
      TAVILY_API_KEY: "Tavily API Key",
      EXA_API_KEY: "Exa API Key",
      BLENDER_BINARY: "Blender 可执行文件路径",
      BLENDER_PORT: "Blender MCP 端口",
      FREECAD_BINARY: "FreeCAD 可执行文件路径",
      FREECAD_RPC_PORT: "FreeCAD RPC 端口",
      visionEnabled: "孪生路由（拖图准入）",
      bridgeEnabled: "附件桥接（图片落盘+改写）",
      unsaved: "未保存",
      readOnly: "只读",
      discard: "放弃",
      save: "保存",
      saving: "保存中…",
      saveFailed: "保存失败",
      collapse: "收起",
      expand: "展开",
      overridden: "已覆盖",
      reset: "重置",
      invalidBool: "无效布尔值",
    };
    const en = {
      title: "Qwen Multimodal (capabilities)",
      description: "Credential/endpoint config for the Qwen-MM capability servers (saved to ~/.qwen-mm-plugins/config, effective after the servers restart), plus twin/bridge toggles.",
      DASHSCOPE_API_KEY: "DashScope API Key",
      DASHSCOPE_API_KEYHint: "Used by api / video-memory / video-edit / edu-agent.",
      DASHSCOPE_BASE_URL: "DashScope base URL",
      DASHSCOPE_BASE_URLHint: "Leave empty for the official default.",
      QWEN_MM_API_VL_MODEL: "VL model (vision_chat/OCR/grounding)",
      QWEN_MM_API_OMNI_MODEL: "Omni model (audio/video understanding)",
      QWEN_MM_SEARCH_BACKEND: "Search backend",
      QWEN_MM_SEARCH_BACKENDHint: "auto / serper / tavily / exa.",
      SERPER_API_KEY: "Serper API Key",
      TAVILY_API_KEY: "Tavily API Key",
      EXA_API_KEY: "Exa API Key",
      BLENDER_BINARY: "Blender executable",
      BLENDER_PORT: "Blender MCP port",
      FREECAD_BINARY: "FreeCAD executable",
      FREECAD_RPC_PORT: "FreeCAD RPC port",
      visionEnabled: "Vision twin route (image admission)",
      bridgeEnabled: "Attachment bridge (export + rewrite)",
      unsaved: "Unsaved",
      readOnly: "Read-only",
      discard: "Discard",
      save: "Save",
      saving: "Saving…",
      saveFailed: "Save failed",
      collapse: "Collapse",
      expand: "Expand",
      overridden: "Overridden",
      reset: "Reset",
      invalidBool: "Invalid boolean",
    };

    const textField = (field) => ({
      field,
      format: (value) => (typeof value === "string" ? value : ""),
      parse: (text) => {
        const trimmed = text.trim();
        return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
      },
    });
    const boolField = (field) => ({
      field,
      format: (value) => (typeof value === "boolean" ? String(value) : ""),
      parse: (text) => {
        if (text === "true") return { kind: "set", value: true };
        if (text === "false") return { kind: "set", value: false };
        if (text.trim() === "") return { kind: "clear" };
        return undefined;
      },
    });

    class Form {
      constructor(scope, specs) {
        this.scope = scope;
        this.specs = new Map(specs.map((s) => [s.field, s]));
        this.staged = new Map();
        this.listeners = new Set();
        this.saving = false;
        this.failed = false;
        scope.subscribe(() => this.publish());
      }
      bind(project) {
        const store = createSnapshotStore(project());
        this.listeners.add(() => store.set(project()));
        return store;
      }
      publish() { for (const l of this.listeners) l(); }
      spec(field) { const s = this.specs.get(field); if (!s) throw new Error(`plugin card has no field ${field}`); return s; }
      snapshot() { return this.scope.getSnapshot(); }
      sectionValue(f) { return this.snapshot().value?.[f]; }
      baseValue(f) { return this.snapshot().base?.[f]; }
      userLayer() { return this.snapshot().user; }
      stored(f) { const u = this.userLayer(); return u !== undefined && Object.prototype.hasOwnProperty.call(u, f); }
      plan() {
        const plan = [];
        for (const [field, staged] of this.staged) {
          const spec = this.spec(field);
          if (staged.clear) {
            if (this.stored(field)) plan.push({ field, run: () => this.clear(field) });
            continue;
          }
          if (staged.text === spec.format(this.sectionValue(field))) continue;
          const write = spec.parse(staged.text);
          if (write === undefined) plan.push({ field, run: undefined });
          else if (write.kind === "clear") plan.push({ field, run: () => this.clear(field) });
          else plan.push({ field, run: () => this.store(field, write.value) });
        }
        return plan;
      }
      shell() {
        const snap = this.snapshot();
        const plan = this.plan();
        return { available: snap.status === "ready", writable: snap.writable, dirty: plan.length > 0, invalid: plan.some((p) => p.run === undefined), saving: this.saving, failed: this.failed };
      }
      field(f) {
        const staged = this.staged.get(f);
        if (staged === undefined) { const spec = this.spec(f); return { text: spec.format(this.sectionValue(f)), overridden: this.stored(f), invalid: false }; }
        const write = staged.clear ? { kind: "clear" } : this.spec(f).parse(staged.text);
        return { text: staged.text, overridden: write?.kind === "set", invalid: write === undefined };
      }
      async clear(field) { await this.scope.unset(field); return !this.stored(field); }
      async store(field, value) { await this.scope.set(field, value); return this.userLayer()?.[field] === value; }
      actions() {
        return {
          edit: (field, text) => { this.staged.set(field, { text, clear: false }); this.failed = false; this.publish(); },
          resetField: (field) => { this.staged.set(field, { text: this.spec(field).format(this.baseValue(field)), clear: true }); this.failed = false; this.publish(); },
          save: () => this.save(),
          discard: () => { if (this.staged.size === 0 && !this.failed) return; this.staged.clear(); this.failed = false; this.publish(); },
        };
      }
      async save() {
        const plan = this.plan();
        const writes = plan.flatMap((item) => item.run === undefined ? [] : [item.run]);
        if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
        this.saving = true; this.failed = false; this.publish();
        let landed = true;
        for (const write of writes) landed = (await write()) && landed;
        if (landed) this.staged.clear();
        this.saving = false; this.failed = !landed;
        this.publish();
      }
    }

    class QwenMmCardController {
      constructor(scope) {
        this.form = new Form(scope, FIELDS.map((f) => (f.kind === "bool" ? boolField(f.field) : textField(f.field))));
        this.store = this.form.bind(() => this.projection());
      }
      projection() {
        const out = { ...this.form.shell() };
        for (const f of FIELD_NAMES) out[f] = this.form.field(f);
        return out;
      }
      inject() { return { hooks: { qwenMmCard: this.store }, ...this.form.actions() }; }
    }

    const css = `.dshqm_f{display:flex;flex-direction:column;gap:4px;padding:9px 0;border-top:1px solid var(--dsw-alias-border-l2)}
.dshqm_head{display:flex;align-items:center;gap:8px}.dshqm_label{flex:1;font:inherit;color:var(--dsw-alias-label-primary);font-size:13px}
.dshqm_input{width:100%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:6px;padding:4px 8px;font:inherit;font-size:13px;color:var(--dsw-alias-label-primary)}
.dshqm_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;margin:0}.dshqm_badge{white-space:nowrap;color:var(--dsw-alias-label-secondary);border-radius:999px;background:var(--dsw-alias-bg-module-platform);padding:1px 8px;font-size:11px}
.dshqm_reset{font:inherit;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px}
.dshqm_card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);list-style:none;padding:0;margin:0;overflow:hidden}
.dshqm_header{display:flex;align-items:center;gap:10px;width:100%;font:inherit;border:0;background:0 0;cursor:pointer;padding:12px 14px;text-align:left}
.dshqm_name{flex:1;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}.dshqm_desc{flex:1 1 100%;color:var(--dsw-alias-label-tertiary);font-size:12px}
.dshqm_body{padding:0 14px}.dshqm_footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 0}
.dshqm_btn{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;font:inherit;cursor:pointer;color:var(--dsw-alias-label-primary);background:0 0}
.dshqm_btn:disabled{opacity:.4;cursor:default}.dshqm_btnP{border:none;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.dshqm_failed{color:var(--dsw-alias-label-error);font-size:12px;margin:0}`;
    if (typeof document !== "undefined" && !document.querySelector("style[data-plugin-css=dshqm]")) {
      const tag = document.createElement("style");
      tag.dataset.pluginCss = "dshqm";
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    function Row(props) {
      const { label, hint, overridden, invalid, disabled, onReset, t, children } = props;
      return h("div", { className: "dshqm_f" },
        h("div", { className: "dshqm_head" },
          h("span", { className: "dshqm_label" }, label),
          overridden ? h("span", { className: "dshqm_badge" }, t("overridden")) : null,
          onReset ? h("button", { type: "button", className: "dshqm_reset", onClick: onReset, disabled }, t("reset")) : null,
        ),
        h("div", null, children),
        invalid ? h("p", { className: "dshqm_failed" }, t("invalidBool")) : null,
        hint ? h("p", { className: "dshqm_hint" }, hint) : null,
      );
    }

    function QwenMmCard(props) {
      const { t } = props;
      const state = props.useQwenMmCard((s) => s);
      if (!state.available) return null;
      const [open, setOpen] = useState(false);
      const disabled = !state.writable;
      const blocked = !state.dirty || state.invalid || state.saving;
      const fieldControls = FIELDS.map((f) => {
        const st = state[f.field];
        const label = t(f.field);
        const hint = t(f.field + "Hint");
        if (f.kind === "bool") {
          const checked = st.text === "true";
          return h(Row, { key: f.field, t, label, hint, overridden: st.overridden, invalid: st.invalid, disabled, onReset: () => props.resetField(f.field), children: h("input", { type: "checkbox", checked, disabled, onChange: (e) => props.edit(f.field, e.target.checked ? "true" : "false") }) });
        }
        return h(Row, { key: f.field, t, label, hint, overridden: st.overridden, disabled, onReset: () => props.resetField(f.field), children: h("input", { type: "text", className: "dshqm_input", value: st.text, disabled, onChange: (e) => props.edit(f.field, e.target.value) }) });
      });
      return h("li", { className: "dshqm_card" },
        h("button", { type: "button", className: "dshqm_header", "aria-expanded": open, onClick: () => setOpen(!open) },
          h("span", { className: "dshqm_name", style: { flex: "none" } }, t("title")),
          h("span", { className: "dshqm_desc" }, t("description")),
          state.dirty ? h("span", { className: "dshqm_badge" }, t("unsaved")) : null,
        ),
        open ? h("div", { className: "dshqm_body" },
          !state.writable ? h("p", { className: "dshqm_hint" }, t("readOnly")) : null,
          fieldControls,
          h("div", { className: "dshqm_footer" },
            state.failed ? h("p", { className: "dshqm_failed" }, t("saveFailed")) : null,
            h("button", { type: "button", className: "dshqm_btn", disabled: !state.dirty || state.saving, onClick: props.discard }, t("discard")),
            h("button", { type: "button", className: "dshqm_btn dshqm_btnP", disabled: blocked, onClick: props.save }, t(state.saving ? "saving" : "save")),
          ),
        ) : null,
      );
    }

    const inject = ["slots", "locale", "connection", "remote", "settingsScope"];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-qwen-mm: card dictionaries");
      const card = new QwenMmCardController(ctx.settingsScope.bind({ namespace: NS }));
      ctx.slots.inject("settings.plugin.item", function* () {
        yield ctx.slots.register({ name: "settings.plugin.item", key: NS, locale: NS, inject: () => card.inject() }, QwenMmCard);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
