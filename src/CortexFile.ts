export interface CortexItem {
  line: number;
  checked: boolean;
  text: string;
  images: string[];
  raw: string;
}

/** Parse a markdown file string into an array of CortexItem objects. */
export function parseItems(content: string): CortexItem[] {
  // Implemented in section-02
  return [];
}

/** Return new file content with a new checkbox item prepended. */
export function prependItem(
  content: string,
  text: string,
  imageEmbed: string,
  showTimestamp: boolean,
  timestampFormat: string
): string {
  // Implemented in section-02
  return content;
}

/** Return new file content with the checkbox at lineIndex toggled. */
export function toggleItem(content: string, lineIndex: number): string {
  // Implemented in section-02
  return content;
}
