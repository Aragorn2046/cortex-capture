export interface CortexItem {
  line: number;
  checked: boolean;
  text: string;
  images: string[];
  raw: string;
}

const CHECKBOX_RE = /^\s*- \[([ xX])\] (.*)$/;
const IMAGE_EMBED_RE = /!\[\[([^\]]+)\]\]/g;

/** Parse a markdown file string into an array of CortexItem objects.
 *  Non-checkbox lines are skipped but their positions count toward line indices. */
export function parseItems(content: string): CortexItem[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const items: CortexItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKBOX_RE);
    if (!match) continue;

    const checked = match[1] === "x" || match[1] === "X";
    const text = match[2].trimEnd();
    const images: string[] = [];

    let imgMatch: RegExpExecArray | null;
    const imgRe = new RegExp(IMAGE_EMBED_RE.source, "g");
    while ((imgMatch = imgRe.exec(text)) !== null) {
      images.push(imgMatch[1]);
    }

    items.push({
      line: i,
      checked,
      text,
      images,
      raw: lines[i],
    });
  }

  return items;
}

/** Build a single checkbox line string for prepending. */
export function buildPrependLine(
  text: string,
  imageEmbed: string,
  showTimestamp: boolean,
  timestamp: string
): string {
  const cleanText = text.replace(/[\n\r]/g, " ");
  const timestampPart = showTimestamp && timestamp ? `[${timestamp}] ` : "";
  const parts = [cleanText, imageEmbed].filter(Boolean);
  return `- [ ] ${timestampPart}${parts.join(" ")}`;
}

/** Return new content with the checkbox at lineIndex toggled.
 *  Returns content unchanged if lineIndex is invalid or line is not a checkbox. */
export function toggleLine(content: string, lineIndex: number): string {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return content;

  const line = lines[lineIndex];
  const match = line.match(CHECKBOX_RE);
  if (!match) return content;

  if (match[1] === " ") {
    lines[lineIndex] = line.replace("- [ ] ", "- [x] ");
  } else {
    lines[lineIndex] = line.replace(/- \[[xX]\] /, "- [ ] ");
  }

  return lines.join("\n");
}

/** Format a Date using simple token replacement. Tokens: YYYY, MM, DD, HH, mm, ss. */
export function formatTimestamp(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return format
    .replace("YYYY", date.getFullYear().toString())
    .replace("MM", pad(date.getMonth() + 1))
    .replace("DD", pad(date.getDate()))
    .replace("HH", pad(date.getHours()))
    .replace("mm", pad(date.getMinutes()))
    .replace("ss", pad(date.getSeconds()));
}
