/* dsh-qwen-mm — browser half: a configurable-plugin card under Settings → 插件
 * → 插件配置 (slot `settings.plugin.item`, keyed by the settings namespace
 * `dsh-qwen-mm`). Mirrors the card contract of
 * `@deepseek-ai/dsh-client-ui-settings-plugins`.
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

    // ── locale dictionaries (all keys the card renders; client package must
    //    not import host packages) ─────────────────────────────────────────
    const zh = {
      title: "Qwen 多模态",
      description: "拖图桥与孪生路由（qwen-mm-vision）开关、Provider 与目录覆盖。",
      visionEnabled: "孪生路由（拖图准入）",
      visionEnabledHint: "关闭后不注册 qwen-mm-vision，图片上传会被 dsh 按纯文本路由拦截。",
      bridgeEnabled: "附件桥接（图片落盘+改写）",
      bridgeEnabledHint: "关闭后图片块不再导出为本地路径。",
      sourceProvider: "源 Provider（被孪生的对象）",
      sourceProviderHint: "留空自动检测（默认 deepseek 系）。",
      twinProvider: "孪生 Provider ID",
      twinProviderHint: "默认 qwen-mm-vision。",
      exportDir: "图片导出目录",
      exportDirHint: "默认 <dshHome>/qwen-mm/attachments。",
      workspaceDir: "工作区副本根目录",
      workspaceDirHint: "副本落在 <目录>/qwen-mm；默认取会话工作区。",
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
      title: "Qwen Multimodal",
      description: "Attachment bridge & vision twin route (qwen-mm-vision) toggles, provider & directory overrides.",
      visionEnabled: "Vision twin route (image admission)",
      visionEnabledHint: "When off, qwen-mm-vision is not registered and image uploads are blocked on text-only routes.",
      bridgeEnabled: "Attachment bridge (export + rewrite)",
      bridgeEnabledHint: "When off, image blocks are not exported to paths.",
      sourceProvider: "Source provider (twin target)",
      sourceProviderHint: "Leave empty to auto-detect (deepseek family).",
      twinProvider: "Twin provider id",
      twinProviderHint: "Defaults to qwen-mm-vision.",
      exportDir: "Image export directory",
      exportDirHint: "Defaults to <dshHome>/qwen-mm/attachments.",
      workspaceDir: "Workspace copy root",
      workspaceDirHint: "Copies land under <dir>/qwen-mm; defaults to the session workspace.",
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

    // ── field specs ────────────────────────────────────────────────────────
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
    const textField = (field) => ({
      field,
      format: (value) => (typeof value === "string" ? value : ""),
      parse: (text) => {
        const trimmed = text.trim();
        return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
      },
    });

    // ── minimal staged form model (scope semantics mirrors host cards) ─────
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
      spec(field) {
        const s = this.specs.get(field);
        if (!s) throw new Error(`plugin card has no field ${field}`);
        return s;
      }
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
        return {
          available: snap.status === "ready",
          writable: snap.writable,
          dirty: plan.length > 0,
          invalid: plan.some((p) => p.run === undefined),
          saving: this.saving,
          failed: this.failed,
        };
      }
      field(f) {
        const staged = this.staged.get(f);
        if (staged === undefined) {
          const spec = this.spec(f);
          return { text: spec.format(this.sectionValue(f)), overridden: this.stored(f), invalid: false };
        }
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
          discard: () => {
            if (this.staged.size === 0 && !this.failed) return;
            this.staged.clear(); this.failed = false; this.publish();
          },
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

    // ── card controller ────────────────────────────────────────────────────
    class QwenMmCardController {
      constructor(scope) {
        this.form = new Form(scope, [
          boolField("visionEnabled"),
          boolField("bridgeEnabled"),
          textField("sourceProvider"),
          textField("twinProvider"),
          textField("exportDir"),
          textField("workspaceDir"),
        ]);
        this.store = this.form.bind(() => this.projection());
      }
      projection() {
        return {
          ...this.form.shell(),
          visionEnabled: this.form.field("visionEnabled"),
          bridgeEnabled: this.form.field("bridgeEnabled"),
          sourceProvider: this.form.field("sourceProvider"),
          twinProvider: this.form.field("twinProvider"),
          exportDir: this.form.field("exportDir"),
          workspaceDir: this.form.field("workspaceDir"),
        };
      }
      inject() {
        return { hooks: { qwenMmCard: this.store }, ...this.form.actions() };
      }
    }

    // ── presentational bits (inline styles; keep it dependency-light) ─────
    const fieldCss = `.dshqm_f{display:flex;flex-direction:column;gap:4px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l2)}

 .dshqm_head{display:flex;align-items:center;gap:8px}.dshqm_label{flex:1;font:inherit;color:var(--dsw-alias-label-primary);font-size:13px}.dshqm_ctl{min-width:180px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:6px;padding:4px 8px;font:inherit;color:var(--dsw-alias-label-primary)}.dshqm_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;margin:0}.dshqm_badge{white-space:nowrap;color:var(--dsw-alias-label-secondary);border-radius:999px;background:var(--dsw-alias-bg-module-platform);padding:1px 8px;font-size:11px}.dshqm_reset{font:inherit;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px}.dshqm_card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);list-style:none;padding:0;margin:0;overflow:hidden}.dshqm_header{display:flex;align-items:center;gap:10px;width:100%;font:inherit;border:0;background:0 0;cursor:pointer;padding:12px 14px;text-align:left}.dshqm_name{flex:1;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}.dshqm_desc{flex:1 1 100%;color:var(--dsw-alias-label-tertiary);font-size:12px}.dshqm_body{padding:0 14px}.dshqm_footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 0}.dshqm_btn{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;font:inherit;cursor:pointer;color:var(--dsw-alias-label-primary);background:0 0}.dshqm_btn:disabled{opacity:.4;cursor:default}.dshqm_btnP{border:none;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}

 .dshqm_failed{color:var(--dsw-alias-label-error);font-size:12px;margin:0}`;
    if (typeof document !== "undefined" && !document.querySelector("style[data-plugin-css=dshqm]")) {
      const tag = document.createElement("style");
      tag.dataset.pluginCss = "dshqm";
      tag.textContent = fieldCss;
      document.head.appendChild(tag);
    }

    function Row(props) {
      const { label, hint, overridden, invalid, disabled, children, onReset, t } = props;
      return h("div", { className: "dshqm_f" },
        h("div", { className: "dshqm_head" },
          h("span", { className: "dshqm_label" }, label),
          overridden ? h("span", { className: "dshqm_badge" }, t("overridden")) : null,
          onReset ? h("button", { type: "button", className: "dshqm_reset", onClick: onReset, disabled }, t("reset")) : null,
        ),
        h("div", { className: "dshqm_ctl" }, children),
        invalid ? h("p", { className: "dshqm_failed" }, t("invalidBool")) : null,
        hint ? h("p", { className: "dshqm_hint" }, hint) : null,
      );
    }

    function BoolControl({ field, onEdit, disabled }) {
      const checked = field.text === "true";
      return h("input", {
        type: "checkbox",
        checked,
        disabled,
        onChange: (e) => onEdit(e.target.checked ? "true" : "false"),
      });
    }

    function TextControl({ field, onEdit, disabled }) {
      return h("input", {
        type: "text",
        className: "dshqm_ctl2",
        value: field.text,
        disabled,
        style: { minWidth: "180px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "6px", padding: "4px 8px", fontSize: "13px" },
        onChange: (e) => onEdit(e.target.value),
      });
    }

    function QwenMmCard(props) {
      const { t } = props;
      const state = props.useQwenMmCard((s) => s);
      if (!state.available) return null;
      const [open, setOpen] = useState(false);
      const disabled = !state.writable;
      const blocked = !state.dirty || state.invalid || state.saving;
      return h("li", { className: "dshqm_card" },
        h("button", { type: "button", className: "dshqm_header", "aria-expanded": open, onClick: () => setOpen(!open) },
          h("span", { className: "dshqm_name", style: { flex: "none" } }, t("title")),
          h("span", { className: "dshqm_desc" }, t("description")),
          state.dirty ? h("span", { className: "dshqm_badge" }, t("unsaved")) : null,
        ),
        open ? h("div", { className: "dshqm_body" },
          !state.writable ? h("p", { className: "dshqm_hint" }, t("readOnly")) : null,
          h(Row, { t, label: t("visionEnabled"), hint: t("visionEnabledHint"), overridden: state.visionEnabled.overridden, invalid: state.visionEnabled.invalid, disabled, onReset: () => props.resetField("visionEnabled"), children: h(BoolControl, { field: state.visionEnabled, disabled, onEdit: (v) => props.edit("visionEnabled", v) }) }),
          h(Row, { t, label: t("bridgeEnabled"), hint: t("bridgeEnabledHint"), overridden: state.bridgeEnabled.overridden, invalid: state.bridgeEnabled.invalid, disabled, onReset: () => props.resetField("bridgeEnabled"), children: h(BoolControl, { field: state.bridgeEnabled, disabled, onEdit: (v) => props.edit("bridgeEnabled", v) }) }),
          h(Row, { t, label: t("sourceProvider"), hint: t("sourceProviderHint"), overridden: state.sourceProvider.overridden, invalid: state.sourceProvider.invalid, disabled, onReset: () => props.resetField("sourceProvider"), children: h(TextControl, { field: state.sourceProvider, disabled, onEdit: (v) => props.edit("sourceProvider", v) }) }),
          h(Row, { t, label: t("twinProvider"), hint: t("twinProviderHint"), overridden: state.twinProvider.overridden, invalid: state.twinProvider.invalid, disabled, onReset: () => props.resetField("twinProvider"), children: h(TextControl, { field: state.twinProvider, disabled, onEdit: (v) => props.edit("twinProvider", v) }) }),
          h(Row, { t, label: t("exportDir"), hint: t("exportDirHint"), overridden: state.exportDir.overridden, invalid: state.exportDir.invalid, disabled, onReset: () => props.resetField("exportDir"), children: h(TextControl, { field: state.exportDir, disabled, onEdit: (v) => props.edit("exportDir", v) }) }),
          h(Row, { t, label: t("workspaceDir"), hint: t("workspaceDirHint"), overridden: state.workspaceDir.overridden, invalid: state.workspaceDir.invalid, disabled, onReset: () => props.resetField("workspaceDir"), children: h(TextControl, { field: state.workspaceDir, disabled, onEdit: (v) => props.edit("workspaceDir", v) }) }),
          h("div", { className: "dshqm_footer" },
            state.failed ? h("p", { className: "dshqm_failed" }, t("saveFailed")) : null,
            h("button", { type: "button", className: "dshqm_btn", disabled: !state.dirty || state.saving, onClick: props.discard }, t("discard")),
            h("button", { type: "button", className: "dshqm_btn dshqm_btnP", disabled: blocked, onClick: props.save }, t(state.saving ? "saving" : "save")),
          ),
        ) : null,
      );
    }

    // ── browser-half entry ─────────────────────────────────────────────────
    const inject = ["slots", "locale", "connection", "remote", "settingsScope"];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-qwen-mm: card dictionaries");
      const card = new QwenMmCardController(ctx.settingsScope.bind({ namespace: NS }));
      ctx.effect(() => () => { /* scope subscription is disposable by fiber */ }, "dsh-qwen-mm: card scope");
      ctx.slots.inject("settings.plugin.item", function* () {
        yield ctx.slots.register({
          name: "settings.plugin.item",
          key: NS,
          locale: NS,
          inject: () => card.inject(),
        }, QwenMmCard);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
