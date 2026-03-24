# Section 02 — CortexFile: File Parsing and Manipulation

## Overview

This section implements `src/CortexFile.ts` — the pure logic module for reading, parsing, and writing the `_Cortex.md` capture file — and its companion test file `src/CortexFile.test.ts`.

This module has **no Obsidian API dependencies in its core parsing/manipulation functions**, making it fully unit-testable with vitest. The only Obsidian surface it touches is `vault.process()` for atomic file writes, which gets injected as a callback parameter rather than imported directly.

**Depends on:** section-01-project-setup (project scaffold, tsconfig, vitest config must exist)

**Blocks:** section-04-cortex-view, section-05-plugin-main, section-07-integration

---

## File Locations

- `/Users/aragorn/projects/cortex-capture/src/CortexFile.ts` — implementation
- `/Users/aragorn/projects/cortex-capture/src/CortexFile.test.ts` — tests

---

## Data Model

```typescript
interface CortexItem {
  line: number;      // line index in the file (0-based)
  checked: boolean;  // true = [x], false = [ ]
  text: string;      // everything after `- [ ] ` or `- [x] `
  images: string[];  // extracted embed filenames: ['capture-123.png']
  raw: string;       // the full original line, unmodified
}
```

Non-checkbox lines (headers, blank lines, other content) are preserved as-is and are not represented as `CortexItem` — they are not returned from the parser. The parser tracks their position internally so that line indices stay stable for toggle operations.

---

## Tests First

Write all tests in `src/CortexFile.test.ts` before implementing. Run with `npx vitest run`. All tests should fail initially, then pass after implementation.

```typescript
// src/CortexFile.test.ts
import { describe, it, expect } from 'vitest'
import { parseItems, buildPrependLine, toggleLine, formatTimestamp } from './CortexFile'

describe('parseItems', () => {
  // Unchecked item
  // Input: '- [ ] hello'
  // Expected: [{ checked: false, text: 'hello', images: [], line: 0, raw: '- [ ] hello' }]

  // Checked item (lowercase x)
  // Input: '- [x] done'
  // Expected: [{ checked: true, text: 'done', images: [], line: 0 }]

  // Checked item (uppercase X)
  // Input: '- [X] done'
  // Expected: [{ checked: true, text: 'done', images: [], line: 0 }]

  // Item with single image embed
  // Input: '- [ ] idea ![[img.png]]'
  // Expected: images: ['img.png']

  // Item with multiple image embeds
  // Input: '- [ ] text ![[a.png]] ![[b.jpg]]'
  // Expected: images: ['a.png', 'b.jpg']

  // Indented item (leading whitespace)
  // Input: '  - [ ] indented'
  // Expected: [{ checked: false, text: 'indented', ... }]

  // Non-checkbox lines are NOT returned from parseItems
  // Input: '# My Header\n\n- [ ] real item'
  // Expected: array of length 1, the header and blank line are not in results

  // Empty text after checkbox marker
  // Input: '- [ ] '
  // Expected: [{ text: '', ... }]

  // Empty file
  // Input: ''
  // Expected: []

  // File with only non-checkbox content
  // Input: '# Header\nsome text'
  // Expected: []
})

describe('buildPrependLine', () => {
  // Basic item, no image, no timestamp
  // buildPrependLine('hello', '', false, '')
  // Expected: '- [ ] hello'

  // Item with image embed
  // buildPrependLine('idea', '![[capture-123.png]]', false, '')
  // Expected: '- [ ] idea ![[capture-123.png]]'

  // Item with timestamp enabled
  // buildPrependLine('hello', '', true, '2026-03-24 14:30')
  // Expected: '- [ ] [2026-03-24 14:30] hello'

  // Strips newlines from input text (multi-line → single-line)
  // buildPrependLine('line one\nline two', '', false, '')
  // Expected: '- [ ] line one line two'

  // Empty text, image only
  // buildPrependLine('', '![[img.png]]', false, '')
  // Expected: '- [ ]  ![[img.png]]'  (note: single leading space before embed)
})

describe('toggleLine', () => {
  // Toggle unchecked → checked, other lines unchanged
  // Input content: '- [ ] first\n- [ ] second', lineIndex: 0
  // Expected: '- [x] first\n- [ ] second'

  // Toggle checked → unchecked
  // Input content: '- [x] done\n- [ ] other', lineIndex: 0
  // Expected: '- [ ] done\n- [ ] other'

  // Toggle correct line by index
  // Input: '- [ ] first\n- [ ] second', lineIndex: 1
  // Expected: '- [ ] first\n- [x] second'

  // Preserves item text and image embeds after toggle
  // Input: '- [ ] idea ![[img.png]]', lineIndex: 0
  // Expected: '- [x] idea ![[img.png]]'

  // Invalid line index → content unchanged, no crash
  // Input: '- [ ] only line', lineIndex: 99
  // Expected: '- [ ] only line' (unchanged)

  // Non-checkbox line at lineIndex → content unchanged
  // Input: '# Header\n- [ ] item', lineIndex: 0
  // Expected: content unchanged (header is not a checkbox line)
})

describe('formatTimestamp', () => {
  // Default format 'YYYY-MM-DD HH:mm'
  // Input: new Date(2026, 2, 24, 14, 30) (March 24 2026, 14:30)
  // Expected: '2026-03-24 14:30'

  // Custom format 'DD/MM/YYYY'
  // Input: new Date(2026, 2, 24, 14, 30)
  // Expected: '24/03/2026'

  // No moment dependency — uses only native Date methods
})
```

---

## Implementation

### `src/CortexFile.ts`

The module exports four pure functions. None of them take an `app` or `vault` argument — they operate on strings only. The calling code in `CortexView.ts` handles the `vault.process()` wrapping.

**`parseItems(content: string): CortexItem[]`**

Splits content by `\n`. Iterates each line with its index. Applies the regex `^\s*- \[([ xX])\] (.*)$` to each line. For matching lines: extracts `checked` (`x` or `X` = true, space = false) and `text` (capture group 2, trimmed). Then extracts image embed filenames from `text` by finding all `![[...]]` patterns with a second regex. Returns only the matched items; non-checkbox lines are skipped in the returned array but their `line` index reflects their actual position in the file.

**`buildPrependLine(text: string, imageEmbed: string, showTimestamp: boolean, timestamp: string): string`**

Constructs the full checkbox line to prepend. Strips newlines from `text` by replacing `\n` and `\r` with spaces. If `showTimestamp` is true and `timestamp` is non-empty, wraps it as `[timestamp] `. Assembles: `- [ ] {timestampPart}{cleanText}{spacedEmbed}`. If both text and embed are present, a single space separates them. If only embed, still produces a valid line.

**`toggleLine(content: string, lineIndex: number): string`**

Splits content by `\n`. Checks whether `lines[lineIndex]` exists and matches the checkbox regex. If it matches: replaces `[ ]` with `[x]` or `[x]`/`[X]` with `[ ]`. Joins and returns. If the line doesn't exist or doesn't match, returns content unchanged.

**`formatTimestamp(date: Date, format: string): string`**

No `moment` import — uses native `Date` methods. Implements a simple token replacer: replaces `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` with zero-padded values from the date object. Returns the formatted string.

### Stub Signatures

```typescript
// src/CortexFile.ts

export interface CortexItem {
  line: number;
  checked: boolean;
  text: string;
  images: string[];
  raw: string;
}

/** Parse file content string into an array of checkbox items. Non-checkbox lines are omitted from the result but their line numbers are preserved in the returned items. */
export function parseItems(content: string): CortexItem[] { ... }

/** Build a single prepend line string. Does not write to disk — caller wraps in vault.process(). */
export function buildPrependLine(
  text: string,
  imageEmbed: string,
  showTimestamp: boolean,
  timestamp: string
): string { ... }

/** Return a new content string with the checkbox at lineIndex flipped. Content unchanged if lineIndex is invalid or line is not a checkbox. */
export function toggleLine(content: string, lineIndex: number): string { ... }

/** Format a Date using a simple YYYY/MM/DD/HH/mm/ss token format. No moment dependency. */
export function formatTimestamp(date: Date, format: string): string { ... }
```

---

## Key Implementation Notes

**Regex:** The checkbox pattern is `^\s*- \[([ xX])\] (.*)$`. The leading `\s*` handles indented items from other tools. Both `x` and `X` are treated as checked. This is applied per-line after splitting on `\n`.

**Image extraction:** After extracting `text` from a checkbox line, apply `/!\[\[([^\]]+)\]\]/g` to find all embed references. Push each capture group (the filename, without the `![[` and `]]` wrappers) into `images[]`.

**Line indices are file-absolute:** A `CortexItem` at `line: 3` means the fourth line (0-based) of the full file. The toggle function uses this directly. This means non-checkbox lines count toward the index — for example if line 0 is a header and line 1 is a checkbox, the item's `line` is `1`.

**Prepend convention:** New items go to the top of the file. The `buildPrependLine` function returns a single line. The caller prepends it by doing `newLine + '\n' + existingContent`. If `existingContent` is empty, the result is just the new line (no trailing newline needed — Obsidian handles this).

**No Obsidian imports in this file.** The module is pure TypeScript. `vault.process()` is called in `CortexView.ts`, not here. This is what makes the module unit-testable without mocking the Obsidian API.

**Timestamp format tokens supported:** `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` — all zero-padded. No support for locale formatting or other tokens. The default format is `YYYY-MM-DD HH:mm`. If an unrecognized token appears in the format string, it is left as-is.

---

## Acceptance Criteria

The section is complete when:

1. `src/CortexFile.test.ts` exists with test cases matching all scenarios above
2. `src/CortexFile.ts` exists and exports `parseItems`, `buildPrependLine`, `toggleLine`, `formatTimestamp`
3. `npx vitest run` passes all tests with zero failures
4. No `moment`, `luxon`, or other date library is imported
5. No `obsidian` import appears anywhere in `CortexFile.ts`