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

/** Cordis plugin name. */
export const name = 'qwen-mm'
/** Service required by the bundled provider. */
export const inject = ['skills']

/** DeepSeek Harness releases this build is validated against. */
export const SUPPORTED_DSH_VERSIONS: readonly string[] = ['0.1.0-rc.6']

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
  const version = detectDshVersion()
  if (version === undefined) {
    throw new Error(
      `qwen-mm: could not detect the running DeepSeek Harness version. Supported versions: ${SUPPORTED_DSH_VERSIONS.join(', ')}. See COMPAT.md for the pairing guide.`,
    )
  }
  if (!SUPPORTED_DSH_VERSIONS.includes(version)) {
    throw new Error(
      `qwen-mm: DeepSeek Harness ${version} is not supported by this plugin build. Supported versions: ${SUPPORTED_DSH_VERSIONS.join(', ')}. Upgrade the plugin or dsh to a matching pair — see COMPAT.md.`,
    )
  }
  warnIfMissing(ctx, 'uvx', 'install uv (https://docs.astral.sh/uv/) to enable the qwen-mm MCP servers')
  warnIfMissing(ctx, 'ffmpeg', 'install ffmpeg to enable video and audio capabilities')

  ctx.skills.registerProvider(() => provider)
}