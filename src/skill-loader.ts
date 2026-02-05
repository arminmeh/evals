import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { SkillDefinition } from './types.js';

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  const [, frontmatterStr, body] = match;
  let frontmatter: Record<string, unknown> = {};

  try {
    frontmatter = parseYaml(frontmatterStr ?? '') as Record<string, unknown>;
  } catch {
    // If YAML parsing fails, return empty frontmatter
    frontmatter = {};
  }

  return {
    frontmatter,
    body: body ?? '',
  };
}

/**
 * Load and parse a skill definition from a SKILL.md file
 */
export async function loadSkill(skillPath: string): Promise<SkillDefinition> {
  if (!existsSync(skillPath)) {
    throw new Error(`Skill file not found: ${skillPath}`);
  }

  const content = await readFile(skillPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  const name = typeof frontmatter['name'] === 'string' ? frontmatter['name'] : 'unnamed-skill';
  const description =
    typeof frontmatter['description'] === 'string' ? frontmatter['description'] : '';
  const version = typeof frontmatter['version'] === 'string' ? frontmatter['version'] : undefined;

  return {
    name,
    description,
    version,
    content: body.trim(),
    frontmatter,
  };
}

/**
 * Format skill content as a system prompt augmentation
 */
export function formatSkillAsPrompt(skill: SkillDefinition): string {
  return `
## Skill: ${skill.name}

${skill.description ? `**Description:** ${skill.description}\n` : ''}
${skill.content}
`.trim();
}

/**
 * Augment a base prompt with skill instructions
 */
export function augmentPromptWithSkill(basePrompt: string, skill: SkillDefinition): string {
  const skillPrompt = formatSkillAsPrompt(skill);

  return `${skillPrompt}

---

# Task

${basePrompt}`;
}
