/**
 * One-time migration: converts plain text lines in _Cortex.md to checkbox format.
 *
 * Usage:
 *   npx ts-node migrate-cortex.ts /path/to/vault/_Cortex.md
 */

import fs from "fs";
import path from "path";

const CHECKBOX_RE = /^\s*- \[[ xX]\] /;

function migrateContent(content: string): { result: string; converted: number; skipped: number } {
  let converted = 0;
  let skipped = 0;

  const lines = content.split("\n");
  const migrated = lines.map((line) => {
    if (line.trim() === "") return line;
    if (CHECKBOX_RE.test(line)) {
      skipped++;
      return line;
    }
    converted++;
    return `- [ ] ${line}`;
  });

  return { result: migrated.join("\n"), converted, skipped };
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx ts-node migrate-cortex.ts <path-to-_Cortex.md>");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, "utf-8");
  const backup = resolved + ".bak";
  fs.writeFileSync(backup, content, "utf-8");
  console.log(`Backup created: ${backup}`);

  const { result, converted, skipped } = migrateContent(content);
  fs.writeFileSync(resolved, result, "utf-8");
  console.log(`Migration complete: ${converted} lines converted, ${skipped} already in checkbox format.`);
}

main();
