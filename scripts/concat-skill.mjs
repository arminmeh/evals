#!/usr/bin/env node

import fs from "fs";
import path from "path";


function extractLocalMdLinks(content) {
  // Match markdown links like [text](file.md) but not URLs
  const linkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  const links = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[2];
    // Skip URLs and absolute paths
    if (!href.startsWith("http") && !href.startsWith("/")) {
      links.push({ text: match[1], file: href, fullMatch: match[0] });
    }
  }

  return links;
}

function concatSkill(skillDir) {
  const entryFile = path.join(skillDir, "SKILL.md");

  if (!fs.existsSync(entryFile)) {
    console.error(`Error: SKILL.md not found in ${skillDir}`);
    process.exit(1);
  }

  let content = fs.readFileSync(entryFile, "utf-8");
  const links = extractLocalMdLinks(content);

  if (links.length === 0) {
    return content;
  }

  // Remove the "Additional resources" section (or similar) that lists the links
  // We'll append the actual content instead
  const resourceSectionRegex =
    /\n## Additional resources\n[\s\S]*?(?=\n## |$)/gi;
  content = content.replace(resourceSectionRegex, "");

  // Also remove any trailing link references if they're standalone
  for (const link of links) {
    const standaloneLink = new RegExp(
      `\\n- \\[${escapeRegex(link.text)}\\]\\(${escapeRegex(link.file)}\\)`,
      "g"
    );
    content = content.replace(standaloneLink, "");
  }

  // Append each referenced file
  const appendedFiles = new Set();

  for (const link of links) {
    if (appendedFiles.has(link.file)) continue;

    const filePath = path.join(skillDir, link.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Referenced file not found: ${filePath}`);
      continue;
    }

    let fileContent = fs.readFileSync(filePath, "utf-8");
    // Remove first H1 heading from appended files
    fileContent = fileContent.replace(/^# .+\n+/, "");
    content += `\n\n${fileContent}`;
    appendedFiles.add(link.file);
  }

  return content.trim() + "\n";
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: concat-skill.js <skill-directory> [output-file]");
  console.error("Example: concat-skill.js ./skills/base-ui");
  console.error("         concat-skill.js ./skills/base-ui output.md");
  process.exit(1);
}

const skillDir = path.resolve(args[0]);
const outputFile = args[1];

const result = concatSkill(skillDir);

if (outputFile) {
  fs.writeFileSync(outputFile, result);
  console.log(`Concatenated skill written to ${outputFile}`);
} else {
  process.stdout.write(result);
}
