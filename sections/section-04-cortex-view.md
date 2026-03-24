# Section 04: CortexView — The Checklist UI

## Overview

This section implements `src/CortexView.ts` — the `ItemView` subclass that provides the entire Cortex 2.0 user interface: the input area, the scrollable checklist, keyboard shortcuts, image preview, and the file watcher that keeps the view in sync with the underlying markdown file.

**Dependencies:**
- `section-01-project-setup` must be complete (TypeScript/build config in place)
- `section-02-cortex-file` must be complete (`CortexFile.ts` and its `CortexItem` interface available)
- `section-03-image-handler` must be complete (`ImageHandler.ts` available)

**Blocks:** `section-05-plugin-main` and `section-07-integration`

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `/Users/aragorn/projects/cortex-capture/01-cortex-capture/src/CortexView.ts` | Create |

No test file with automated tests for this section — all tests are manual (see Testing section below). The Obsidian API surfaces (workspace, vault, DOM lifecycle) are not feasibly unit-tested without a full Obsidian mock. Tests for the pure logic that CortexView delegates to (`CortexFile`, `ImageHandler`) live in their own sections.

---

## Tests (Manual — Execute During/After Implementation)

From `claude-plan-tdd.md` section 4:

```
// Test: view opens when ribbon icon clicked
// Test: view opens when command palette entry selected
// Test: view reuses existing leaf if already open
// Test: input textarea receives focus on view open
// Test: submitting text creates checkbox item at top of list
// Test: submitting clears input field and image preview
// Test: checkbox click toggles checked state in UI and file
// Test: external file modification (edit in editor) triggers view refresh
// Test: self-modifications do NOT trigger redundant re-render (ignoreNextModify flag)
// Test: image thumbnails render inline with item text
// Test: Enter key submits on desktop
// Test: Escape clears input
```

Test the mobile layout tests from section 7 alongside this section too (they are CSS-driven but their trigger is `Platform.isMobile` logic in this file):

```
// Test: input area appears at bottom on mobile (body.is-mobile)
// Test: input area appears at top on desktop
// Test: all buttons meet 44px minimum touch target
// Test: checkbox tap area is 44px+ on mobile
// Test: image button is visually prominent on mobile (not tiny icon)
// Test: layout is single-column full-width on phone screen
```

---

## Implementation

### View Type Constant

The view type string must match exactly what `main.ts` registers. Define it as an exported constant so both files can import it:

```typescript
export const CORTEX_VIEW_TYPE = 'cortex-view';
```

### Class Skeleton

```typescript
import { ItemView, WorkspaceLeaf, TFile, Platform, Notice } from 'obsidian';
import { CortexFile, CortexItem } from './CortexFile';
import { ImageHandler } from './ImageHandler';
import type CortexCapturePlugin from '../main';

export class CortexView extends ItemView {
  private plugin: CortexCapturePlugin;
  private cortexFile: CortexFile;
  private imageHandler: ImageHandler;

  // DOM refs
  private textarea: HTMLTextAreaElement;
  private fileInput: HTMLInputElement;
  private imagePreviewEl: HTMLElement;
  private listEl: HTMLElement;

  // State
  private pendingImageEmbed: string | null = null;
  private ignoreNextModify = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: CortexCapturePlugin) { ... }

  getViewType(): string { return CORTEX_VIEW_TYPE; }
  getDisplayText(): string { return 'Cortex'; }
  getIcon(): string { return 'brain'; }

  async onOpen(): Promise<void> { ... }
  async onClose(): Promise<void> { ... }

  private buildUI(): void { ... }
  private buildInputArea(container: HTMLElement): void { ... }
  private buildChecklist(container: HTMLElement): void { ... }

  private async submitItem(): Promise<void> { ... }
  private async refreshChecklist(): Promise<void> { ... }
  private renderItem(item: CortexItem): HTMLElement { ... }
  private renderImageThumbnail(embed: string): HTMLElement | null { ... }

  private attachFileWatcher(): void { ... }
  private onFileModified(file: TFile): void { ... }
}
```

### `onOpen()` Flow

1. Call `buildUI()` to construct the DOM inside `this.contentEl`
2. Call `refreshChecklist()` to load and render the current file contents
3. Attach the file watcher (via `this.registerEvent(...)`)
4. Focus the textarea

### DOM Structure

Build inside `this.contentEl`. Clear it first. Create a single wrapper div with class `cortex-container` (flex column; CSS in `section-06-styles` reverses to `column-reverse` on mobile via `body.is-mobile`).

**Input area** (`cortex-input-area`):
- `<textarea class="cortex-textarea">` — placeholder: "Capture an idea...", auto-grows (CSS or JS resize)
- Image button: on mobile, a visible button labeled "Add Image" (44px+ height); on desktop, a smaller icon button. Both trigger the same hidden `<input type="file" accept="image/*">`
- Image preview container (`cortex-image-preview`, hidden by default): shows `<img>` thumbnail + an "×" remove button when `pendingImageEmbed` is set
- Submit button (`cortex-submit-btn`, minimum 44px on mobile)

**Checklist** (`cortex-list`, `role="list"`):
- Populated by `refreshChecklist()`
- Each item is a div with class `cortex-item` and `role="listitem"`

### `buildInputArea(container)` Details

Use `Platform.isMobile` to set a `data-mobile` attribute or a CSS class on the button so styles in `section-06-styles` can target it. Do not inline platform-specific styles in JS — keep visual decisions in CSS.

Attach event handlers with `this.registerDomEvent(el, event, handler)` (not raw `addEventListener`) so Obsidian auto-cleans them on `onClose()`.

Key events to register:
- `textarea` — `keydown`: on `Enter` (without Shift) call `submitItem()`, on `Escape` clear input and preview
- `textarea` — `paste`: call `imageHandler.handlePaste(event)` — if an image is returned, set `pendingImageEmbed` and show preview
- `cortex-input-area` — `dragover`: `event.preventDefault()` to allow drop
- `cortex-input-area` — `drop`: call `imageHandler.handleDrop(event)` — if image returned, same preview flow
- `fileInput` — `change`: call `imageHandler.handleFileInput(fileInput.files)` — same preview flow
- Submit button — `click`: call `submitItem()`
- Remove-image button — `click`: clear `pendingImageEmbed`, hide preview

### `submitItem()` Flow

1. Read `textarea.value`, strip newlines (replace `\n` and `\r` with a space), trim
2. If both text and `pendingImageEmbed` are empty — return early (nothing to capture)
3. Set `ignoreNextModify = true`
4. Call `cortexFile.prepend(text, pendingImageEmbed ?? undefined)`
5. Clear `textarea.value`, clear `pendingImageEmbed`, hide image preview
6. Call `refreshChecklist()` (re-render from file)
7. Focus textarea

### `refreshChecklist()` Flow

1. Read items via `cortexFile.readItems()`
2. Clear `this.listEl`
3. For each item, call `renderItem(item)` and append to `this.listEl`

The checklist shows **all** items — both checked and unchecked. Checked items may be visually de-emphasized (strike-through via CSS, lighter opacity) but are not hidden. This matches the "inbox review" mental model — user sees what's been processed.

### `renderItem(item: CortexItem)` Details

Returns an `HTMLElement` (div). Structure:

```
div.cortex-item [role="listitem"]
  input[type="checkbox"] (checked = item.checked)
  span.cortex-item-text  (rendered markdown text)
  div.cortex-item-images (zero or more <img> thumbnails)
```

Checkbox `change` event: on toggle, set `ignoreNextModify = true`, call `cortexFile.toggle(item.line)`, then call `refreshChecklist()`.

Text rendering: apply simple regex-based inline markdown (bold `**text**` → `<strong>`, italic `*text*` → `<em>`, links `[text](url)` → `<a>`). Do NOT use `MarkdownRenderer.renderMarkdown()` — it requires an active component/context, adds overhead, and is overkill for single-line items.

Image thumbnails: for each filename in `item.images`, call `renderImageThumbnail(embed)`. This method:
1. Looks up the file in the vault: `this.app.vault.getAbstractFileByPath(filename)` (try both the bare filename and the full attachment path)
2. If found as a `TFile`, call `this.app.vault.getResourcePath(tFile)` to get a displayable URL
3. Create an `<img>` element with that src, class `cortex-thumb`, CSS-constrained (max-width set in `styles.css`)
4. If the file is not found, return null (embed may reference an image not yet synced)

**Risk note**: `getResourcePath()` returns `file://` protocol on desktop and an app-specific protocol on mobile. Verify this works in a custom `ItemView` context during testing — if it doesn't, the fallback is skipping thumbnails and just showing the embed text.

### File Watcher

In `onOpen()`, register:

```typescript
this.registerEvent(
  this.app.vault.on('modify', (file) => this.onFileModified(file as TFile))
);
```

`onFileModified(file)`:
1. Check that `file.path` matches the configured capture file path — ignore all other file modifications
2. Check `ignoreNextModify` flag — if true, reset to false and return (this was a self-write)
3. Cancel any pending debounce timer
4. Set a new debounce timer (300ms) that calls `refreshChecklist()`

The `ignoreNextModify` flag is set synchronously before `vault.process()` in both `submitItem()` and the checkbox toggle handler. This prevents the write→watch→re-render cycle that would otherwise fire on every user action.

### `onClose()` Cleanup

`this.contentEl.empty()` to remove DOM. The `registerEvent()` and `registerDomEvent()` calls are automatically cleaned up by Obsidian's `Component` base class — no manual removal needed.

---

## Data Flow Summary

```
User types + presses Enter
  → submitItem()
  → cortexFile.prepend(text, imageEmbed)    [sets ignoreNextModify=true first]
  → refreshChecklist()                       [re-reads file, re-renders list]

User clicks checkbox
  → cortexFile.toggle(item.line)            [sets ignoreNextModify=true first]
  → refreshChecklist()

External file change (cron, sync, manual edit)
  → vault.on('modify') fires
  → ignoreNextModify is false → debounce 300ms → refreshChecklist()

User pastes image (desktop)
  → imageHandler.handlePaste(event) → returns embed string
  → pendingImageEmbed set, preview shown
  → next submit appends embed to item

User taps "Add Image" (mobile)
  → hidden <input type="file"> .click()
  → user picks image → fileInput.change fires
  → imageHandler.handleFileInput(files) → returns embed string
  → same preview flow
```

---

## Interfaces from Dependencies

`CortexView.ts` imports these from completed sections. Do not redefine them.

**From `section-02-cortex-file` (`src/CortexFile.ts`):**

```typescript
interface CortexItem {
  line: number;
  checked: boolean;
  text: string;
  images: string[];  // filenames only, e.g. ['capture-20260324.png']
  raw: string;
}

class CortexFile {
  constructor(app: App, settings: CortexSettings) {}
  async readItems(): Promise<CortexItem[]>
  async prepend(text: string, imageEmbed?: string): Promise<void>
  async toggle(lineIndex: number): Promise<void>
}
```

**From `section-03-image-handler` (`src/ImageHandler.ts`):**

```typescript
class ImageHandler {
  constructor(app: App, settings: CortexSettings) {}
  async handlePaste(event: ClipboardEvent): Promise<string | null>
  async handleDrop(event: DragEvent): Promise<string | null>
  async handleFileInput(files: FileList | null): Promise<string | null>
}
```

**From `src/settings.ts` (created in `section-05-plugin-main` or alongside it):**

```typescript
interface CortexSettings {
  captureFile: string;       // default: '_Cortex.md'
  prependNew: boolean;       // default: true
  showTimestamps: boolean;   // default: false
  timestampFormat: string;   // default: 'YYYY-MM-DD HH:mm'
}
```

---

## CSS Classes (Defined in `section-06-styles`)

The following class names must be used exactly as listed — `section-06-styles` targets them:

| Class | Element | Notes |
|-------|---------|-------|
| `cortex-container` | outer wrapper div | flex column; reversed on mobile |
| `cortex-input-area` | input section wrapper | drag-drop target on desktop |
| `cortex-textarea` | the textarea | auto-grow, full width |
| `cortex-image-btn` | image attachment button | prominent on mobile |
| `cortex-image-preview` | preview container | hidden when no image pending |
| `cortex-thumb` | image thumbnail `<img>` | max-width constrained |
| `cortex-submit-btn` | submit button | 44px min-height on mobile |
| `cortex-list` | checklist container | scrollable |
| `cortex-item` | individual item div | flex row |
| `cortex-item-text` | text span | inline markdown rendered |
| `cortex-item-images` | image container div | thumbnails row |
| `cortex-item--checked` | modifier on `cortex-item` | strike-through, reduced opacity |

Apply `cortex-item--checked` class in `renderItem()` when `item.checked === true`.

---

## Edge Cases to Handle

| Scenario | Handling |
|----------|----------|
| Empty textarea + no image on submit | Return early, do nothing |
| Newlines in textarea | Strip to spaces before prepending |
| Image file not found in vault during render | Return `null` from `renderImageThumbnail()`, skip thumbnail |
| `getResourcePath()` fails on mobile | Degrade gracefully — log to console, no thumbnail, item text still shows |
| File watcher fires on unrelated file | Check `file.path` matches capture file, ignore if not |
| Rapid multiple file modifications (sync burst) | 300ms debounce absorbs multiple events into one render |
| View opened multiple times | `activateView()` in `main.ts` reuses existing leaf — handled at plugin level |
| 200+ items in checklist | Simple rendering for v1; optimize with viewport windowing only if measured lag occurs |