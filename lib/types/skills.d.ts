/**
 * Bundled Qwen-MM-Plugins skill provider.
 *
 * @module @deepseek-ai/dsh-qwen-mm
 */
import { type SkillProvider } from '@deepseek-ai/dsh-skill';
/** One vendored Qwen-MM-Plugins capability skill. */
interface SkillEntry {
    /** Kebab-case skill name, identical to the upstream frontmatter `name`. */
    readonly name: string;
    /** Routing description, identical to the upstream frontmatter `description`. */
    readonly description: string;
    /** Asset file name under `assets/skills/`. */
    readonly file: string;
}
/** The vendored capability catalog, generated from the pinned upstream release tags. */
export declare const SKILL_ENTRIES: readonly SkillEntry[];
/** The Qwen-MM-Plugins bundled skill provider. */
export declare const provider: SkillProvider;
export {};
