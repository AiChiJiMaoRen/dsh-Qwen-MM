/**
 * Qwen-MM-Plugins integration bundle plugin: registers the bundled skill
 * provider on `ctx.skills` and guards the composition against unsupported
 * DeepSeek Harness versions. The MCP server rows and the twin vision route
 * live in the bundle patch (`cordis.patch.yml`).
 *
 * @module @deepseek-ai/dsh-qwen-mm
 */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import type { Context } from '@deepseek-ai/cordis'
import { provider } from './skills.ts'
import { installSettings } from './settings.ts'

/** Cordis plugin name. */
export const name = 'qwen-mm'
/** Service required by the bundled provider. */
export const inject = ['skills']

/** dsh releases this build has been validated against (advisory, not blocking). */
export const SUPPORTED_DSH_VERSIONS: readonly string[] = ['0.1.0-rc.6', '0.1.0-rc.7']

/** Read the running harness version from the harmonized app-boot package. */
export function detectDshVersion(): string | undefined {
  try {
    const require = createRequire(import.meta.url)
    return require('@deepseek-ai/dsh-app-boot/package.json').version as string
  } catch {
    return undefined
  }
}

/** Warn once when a runtime dependency binary is missing from PATH. */
function warnIfMissing(ctx: Context, binary: string, hint: string): void {
  const result = spawnSync(binary, ['--version'], { stdio: 'ignore', windowsHide: true })
  if (result.error !== undefined) {
    ctx.logger.warn(`qwen-mm: "${binary}" was not found on PATH (${hint}). Capabilities that depend on it will be unavailable.`)
  }
}

/** Register the bundled skill provider and guard the runtime environment. */
export function apply(ctx: Context): void {
  // Version check is ADVISORY, never blocking: dsh releases evolve fast and
  // this plugin only uses stable public seams, so an unlisted version must not
  // take the plugin down. Unknown versions warn once and load anyway.
  const version = detectDshVersion()
  if (version === undefined) {
    ctx.logger.warn(`qwen-mm: could not detect the running dsh version; loading anyway (validated: ${SUPPORTED_DSH_VERSIONS.join(', ')}). See COMPAT.md.`)
  } else if (!SUPPORTED_DSH_VERSIONS.includes(version)) {
    ctx.logger.warn(`qwen-mm: dsh ${version} is not in the validated list (${SUPPORTED_DSH_VERSIONS.join(', ')}). Loading anyway — if anything breaks, check COMPAT.md for the pairing guide.`)
  } else {
    ctx.logger.info(`qwen-mm: dsh ${version} (validated)`)
  }
  warnIfMissing(ctx, 'uvx', 'install uv (https://docs.astral.sh/uv/) to enable the qwen-mm MCP servers')
  warnIfMissing(ctx, 'ffmpeg', 'install ffmpeg to enable video and audio capabilities')

  // Serve the GUI settings namespace (Settings → 插件 → 插件配置).
  installSettings(ctx)

  ctx.skills.registerProvider(() => provider)
}