/**
 * skill-loader.ts — Domain skill activation from .claude/skills/
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Reads SKILL.md files, parses frontmatter, memoizes per process.
 * Edge-safe: gracefully degrades when fs is unavailable.
 */

export interface SkillFrontmatter {
  name: string;
  description: string;
  [key: string]: unknown;
}

export interface ActivatedSkill {
  name: string;
  frontmatter: SkillFrontmatter;
  body: string;
  /** Context passed at activation time */
  ctx: Record<string, unknown>;
}

// Memoize per skill name for the lifetime of the process / request
const _cache = new Map<string, { frontmatter: SkillFrontmatter; body: string }>();

/**
 * Parse YAML-ish frontmatter between --- delimiters.
 * Supports simple key: value pairs (no nested objects).
 */
function parseFrontmatter(raw: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: { name: 'unknown', description: '' }, body: raw };
  }

  const fmLines = match[1].split('\n');
  const frontmatter: Record<string, string> = {};
  for (const line of fmLines) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    frontmatter[key] = value;
  }

  return {
    frontmatter: {
      name: frontmatter.name ?? 'unknown',
      description: frontmatter.description ?? '',
      ...frontmatter,
    },
    body: match[2].trim(),
  };
}

async function readSkillFile(skillPath: string): Promise<string> {
  // Dynamic import of node:fs to allow edge environments to skip gracefully
  const { readFile } = await import('node:fs/promises');
  return readFile(skillPath, 'utf-8');
}

function resolveSkillPath(name: string, base: string): string {
  // Use string join to avoid path module import in edge
  return `${base}/${name}/SKILL.md`;
}

function skillsRoot(): string {
  const override = process.env.OPENCLAW_SKILLS_ROOT;
  if (override) return override;
  // Default: .claude/skills relative to cwd
  const cwd = typeof process !== 'undefined' ? process.cwd() : '/';
  return `${cwd}/.claude/skills`;
}

function bundledSkillsRoot(): string {
  // Relative to this source file location — src/lib/openclaw/skills/
  const cwd = typeof process !== 'undefined' ? process.cwd() : '/';
  return `${cwd}/src/lib/openclaw/skills`;
}

/**
 * Activate a skill by name.
 * Reads SKILL.md, parses frontmatter, caches result.
 * Falls back to bundled skills directory if project-level not found.
 */
export async function activateSkill(
  name: string,
  ctx: Record<string, unknown> = {},
): Promise<ActivatedSkill> {
  if (_cache.has(name)) {
    const cached = _cache.get(name)!;
    return { name, ...cached, ctx };
  }

  const primaryPath = resolveSkillPath(name, skillsRoot());
  const bundledPath = resolveSkillPath(name, bundledSkillsRoot());

  let raw: string;
  try {
    raw = await readSkillFile(primaryPath);
  } catch {
    try {
      raw = await readSkillFile(bundledPath);
    } catch {
      throw new Error(
        `OpenClaw: skill '${name}' not found at ${primaryPath} or ${bundledPath}`,
      );
    }
  }

  const parsed = parseFrontmatter(raw);
  _cache.set(name, parsed);
  return { name, ...parsed, ctx };
}

/** Test helper: clear memoization cache */
export function _clearSkillCache(): void {
  _cache.clear();
}
