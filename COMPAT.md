# Compatibility

`dsh-qwen-mm` targets DeepSeek Harness releases without any harness core
patch. This build is validated against the following matrix.

## Version matrix

| Plugin | DeepSeek Harness | Status |
|---|---|---|
| `@deepseek-ai/dsh-qwen-mm@0.1.0` | `0.1.0-rc.6` | ✅ validated |
| `@deepseek-ai/dsh-qwen-mm@0.1.0` | `0.1.0-rc.7` | ✅ validated |

The plugin refuses to start on a version outside the matrix (strict version
guard): the `qwen-mm` row throws at boot with a clear message naming the
supported versions, and the peerDependencies in `package.json` encode the same
range for install-time checks.

## What the guard covers

- **Version detection:** the `qwen-mm` row reads the running harness version
  from `@deepseek-ai/dsh-app-boot/package.json` (all harness packages ship
  harmonized versions) and compares it against `SUPPORTED_DSH_VERSIONS` in
  `src/index.ts`.
- **Runtime seams used by the plugin (must stay compatible across upgrades):**
  - `ctx.skills.registerProvider()` (skill provider registration)
  - `ctx.llm.registerAdapter()` / `ctx.llm.stream()` / `ctx.llm.listProviders()`
  - `ctx.agentDefaultModel.currentSelection()` / `saveSelection()`
  - `agent/pre-step` and `agent/request` waterfall events (payload gains `agent`
    from the fused dispatcher in 0.1.0-rc.x)
  - `ctx.attachments.readImage()` (durable attachment seam)
  - `@deepseek-ai/dsh-mcp-client` rows (stdio transport)

## Upgrading dsh

1. Check the matrix above. If your target dsh version is listed, reinstall the
   matching plugin version and boot.
2. If the target is not listed: upgrade the plugin first if a newer build
   exists, otherwise extend `SUPPORTED_DSH_VERSIONS` (and the peer ranges)
   *after* verifying the seams above against the new release — the dsh-suite
   daily compat tests are the fastest way to learn what changed.
3. Boot the profile; the `qwen-mm` row either loads (version supported) or
   throws with the supported list. No partial degradation, no silent breakage.

## Notes

- The MCP servers and vendored skills are version-pinned to immutable upstream
  release tags and are independent of the dsh release; they do not move on dsh
  upgrades.
- The twin vision route (`qwen-mm-vision`) does not patch the harness core; it
  relies on the provider registration and default-model-selection seams above.