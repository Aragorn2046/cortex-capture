# Cortex 2.0 — Implementation Plan

## 1. Project Overview

### What We're Building

An Obsidian plugin called **Cortex 2.0** — a checklist-based quick capture tool that replaces a plain-text inbox file (`_Cortex.md`) with an interactive view. Users dump ideas, screenshots, and reminders into a single markdown file via a dedicated UI. Each item is a standard markdown checkbox (`- [ ] text ![[image]]`) that can be checked off when processed.

### Why

The current workflow is a raw markdown file edited by hand. It has no image support, no visual separation between items, no "processed" state, and new items go to the bottom (inconvenient). The user captures ideas primarily on Android (on the go), secondarily on desktop (Mac/Windows). Speed and zero-friction are non-negotiable.

### Who Uses It

Single user with an Obsidian vault synced across three machines (two Windows/WSL2, one macOS) and an Android phone. A cron job (Claude AI) processes items from the file periodically, promoting them to projects, todos, or full notes. The plugin must not break this external processing pipeline.

---

## 2. Architecture

### Plugin Registration

The plugin is an Obsidian `Plugin` subclass. On load it:
1. Registers a custom `ItemView` type (`cortex-view`)
2. Adds a ribbon icon (left sidebar) that opens the Cortex view
3. Adds a command ("Cortex: Open capture view") for the command palette
4. Registers a URI handler (`obsidian://cortex`) for external launches (Android homescreen, Tasker)
5. Loads settings from `data.json`

On unload: detaches all `cortex-view` leaves and cleans up.

### File as Source of Truth

The plugin reads from and writes to a single markdown file (default: `_Cortex.md` in vault root, configurable). The file is standard checkbox markdown. The plugin never uses a database, local storage, or custom data format.

Every UI interaction (new item, checkbox toggle) writes back to the file immediately via `vault.process()` for atomic read-modify-write. This prevents race conditions with concurrent sync writes. The view re-renders from the file content. External changes to the file (Obsidian Sync, other plugins, manual edits, Claude cron) are detected via `vault.on('modify')` and trigger a view refresh.

### Sync Conflict Awareness

The vault syncs across 4 devices. Since all prepends modify the top of the file, concurrent captures from two offline devices could create a sync conflict (Obsidian Sync uses last-write-wins with conflict file backup). This is acceptable for a capture inbox — the conflict file preserves anything that would be lost, and the user or cron can recover items from it. Document this limitation.

### Module Decomposition

```
cortex-capture/
├── manifest.json
├── main.ts              # Plugin lifecycle, view registration, commands, URI handler
├── src/
│   ├── CortexView.ts    # ItemView subclass — the UI
│   ├── CortexFile.ts    # File I/O — parse, prepend, toggle, read
│   ├── ImageHandler.ts  # Image saving — paste, drop, file picker, vault storage
│   └── settings.ts      # Settings interface, defaults, tab
├── styles.css
├── package.json
├── tsconfig.json
└── esbuild.config.mjs
```

**`main.ts`** — Plugin entry point. Registers the view factory, ribbon icon, command, URI handler. Passes settings and app reference to all modules. Handles `onload()` / `onunload()` lifecycle.

**`CortexView.ts`** — The `ItemView` subclass. Builds the DOM: input area (text field, image button, submit), checklist items. Handles user interactions (submit, checkbox toggle, image paste/drop). Listens for file changes to re-render.

**`CortexFile.ts`** — Pure file operations. Reads the markdown file, parses it into an array of items (text, checked state, image embeds). Prepends a new item. Toggles a checkbox by line index. Returns the modified content string — the caller writes it to the vault.

**`ImageHandler.ts`** — Handles all image input paths. Desktop: clipboard paste event, drag-and-drop event. Mobile: `<input type="file">` change event. All paths converge on the same save function: `File` → `ArrayBuffer` → `vault.createBinary()` at the path from `fileManager.getAvailablePathForAttachment()`. Returns the embed string `![[filename.png]]`.

**`settings.ts`** — Settings interface with defaults, and a `PluginSettingTab` subclass for the settings UI.

---

## 3. CortexFile — File Parsing and Manipulation

### Data Model

```typescript
interface CortexItem {
  line: number;        // line index in the file
  checked: boolean;    // true = [x], false = [ ]
  text: string;        // everything after `- [ ] ` or `- [x] `
  images: string[];    // extracted embed filenames: ['capture-123.png']
  raw: string;         // the full original line
}
```

### Parsing

Read the file content as a string. Split by newline. For each line matching the regex `^\s*- \[([ xX])\] (.*)$`, extract `checked` and `text`. Accept both lowercase `x` and uppercase `X`. Trim leading whitespace before matching (handles indented items from other tools). From the text, extract all `![[...]]` patterns as image references.

Lines that don't match the checkbox pattern are preserved as-is (supporting headers, blank lines, or non-checkbox content in the file).

### Prepend

To add a new item: construct the line (`- [ ] {text} {imageEmbed}`), then prepend it to the file content. Write back with `vault.process()` for atomic operation.

If timestamps are enabled in settings, prepend the timestamp to the text: `- [ ] [2026-03-24 14:30] {text} {imageEmbed}`. Timestamps use a simple `Date`-based formatter (no `moment` dependency — it's deprecated in Obsidian and may be removed).

**Items are single-line.** Newlines in the input textarea are stripped to spaces on submit. This keeps parsing simple and matches the current Cortex workflow (one idea per line).

### Toggle Checkbox

Given a line index, use `vault.process(file, (content) => { ... return modified })` to atomically read the file, find the line, flip `[ ]` ↔ `[x]`, and write back. All file mutations (prepend, toggle) use `vault.process()` for atomic read-modify-write, preventing race conditions with concurrent sync writes.

---

## 4. CortexView — The Checklist UI

### View Registration and Opening

The view type is `cortex-view`. The plugin registers it with a factory function in `onload()`.

To open: check if a leaf with `cortex-view` already exists (reuse it), otherwise create a new leaf via `workspace.getLeaf(true)` and set its view state. Then `revealLeaf()`.

The view opens as a **tab** in the main workspace. On mobile this is full-screen. On desktop it's a switchable tab alongside notes.

### DOM Structure

The view builds its UI inside `this.contentEl` (never `containerEl.children[1]`).

**Input area**: A container div at the top (desktop) or bottom (mobile, using CSS `order` or `flex-direction: column-reverse` on the parent). Contains:
- A `<textarea>` for text input (auto-grows, placeholder: "Capture an idea...")
- An image attachment button that triggers a hidden `<input type="file" accept="image/*">` on mobile, or shows a visual drop zone on desktop
- An image preview area (hidden when no image attached, shows thumbnail when image is pending)
- A submit button (prominent, minimum 44px on mobile)

**Checklist**: A scrollable container below (or above on mobile) the input area with `role="list"`. Each item is a div with `role="listitem"` containing:
- A checkbox `<input type="checkbox">` — toggling dispatches a checkbox toggle operation
- A text span with basic rendered markdown (bold, italic, links, but NOT full Obsidian rendering — use simple regex replacement for performance)
- Image thumbnails (if item has `![[...]]` embeds) — rendered as `<img>` tags using `app.vault.getResourcePath(tFile)` for the URL, CSS-constrained to max-width. **Risk**: verify `getResourcePath()` works in custom ItemView on mobile during implementation — desktop returns `file://` protocol, mobile returns an app-specific protocol

### Keyboard Shortcuts (Desktop)

- **Enter** in textarea: Submit the item (prepend to file, clear input)
- **Escape**: Clear input and image preview
- **Ctrl/Cmd+V**: If image in clipboard, attach it (desktop only)

Note: No Shift+Enter for multi-line. Items are single-line by design (newlines stripped on submit).

### File Change Watching

Register `vault.on('modify', callback)` filtered to the capture file path. On external modification, re-read the file and re-render the checklist. Use a debounce (300ms) to avoid excessive re-renders during sync bursts.

**Self-modification exclusion**: When the plugin itself writes to the file (prepend, toggle), it sets an `ignoreNextModify` flag before the write. The file watcher checks this flag and skips the redundant re-render for self-triggered modifications. This prevents the write→watch→re-render cycle on every user action.

### Performance

Start with simple DOM rendering (create elements for each item). If the list exceeds 200 items, the re-render may become slow. At that point, implement a simple windowing approach: only render items visible in the scroll viewport plus a buffer. For v1, simple rendering is fine — optimize only if needed.

---

## 5. ImageHandler — Cross-Platform Image Support

### Desktop: Clipboard Paste

Attach a `paste` event listener to the textarea (via `registerDomEvent` for auto-cleanup). On paste:
1. Check `event.clipboardData.files` for image files
2. If image found: prevent default, read as `ArrayBuffer`
3. Generate filename: `capture-{YYYYMMDDHHmmss}.{ext}`
4. Get attachment path: `fileManager.getAvailablePathForAttachment(filename, captureFilePath)`
5. Save: `vault.createBinary(path, arrayBuffer)`
6. Show thumbnail preview in the input area
7. Store the embed string `![[filename]]` — it gets appended to the item text on submit

### Desktop: Drag-and-Drop

Attach `dragover` (prevent default to allow drop) and `drop` event listeners to the input area. On drop:
1. Check `event.dataTransfer.files` for images
2. Same save flow as clipboard paste

### Mobile: File Picker

Create a hidden `<input type="file" accept="image/*">` element. The visible image button triggers `input.click()`. On `change` event:
1. Read `input.files[0]`
2. Same save flow — `ArrayBuffer` → `createBinary()` → embed string

On mobile, `accept="image/*"` gives the user a choice of camera or gallery (standard Android behavior). Adding `capture="environment"` would default to camera — but since screenshots (gallery) are the primary use, omit `capture` to let the user choose.

### Image Preview

After attaching an image (any path), show a thumbnail preview in the input area. CSS max-width: 120px, with a small "x" button to remove the attachment before submitting. This gives visual confirmation that the image is attached.

### Error Handling

If `createBinary()` fails (e.g., disk full), show an Obsidian `Notice` with the error and don't add the embed to the item. The text portion of the capture still works.

---

## 6. URI Handler and Android Integration

### Protocol Handler Registration

In `onload()`, register:
```typescript
this.registerObsidianProtocolHandler('cortex', handler)
```

The handler receives a params object decoded from the URL query string.

### Supported Parameters

| Parameter | Description |
|-----------|-------------|
| `text` | Text content to pre-fill in the input area |
| `image` | URL-encoded path to an image file to attach |
| `submit` | If `true`, auto-submit the item (no manual tap needed) |

### URI Handler Flow

1. Parse params
2. Open/reveal the Cortex view (same `activateView()` logic)
3. If `text` provided: populate the input textarea
4. If `image` provided: resolve the file path, save to vault attachments, show preview
5. If `submit=true`: **wait for image processing to complete** (async), then auto-submit the item. The image save is asynchronous — auto-submit must not fire before the embed string is ready.
6. If `submit` not set: leave the view open with content pre-filled so user can add context

### Tasker Integration (Android)

**Tasker profile** (documented in README):
1. **Trigger**: Share intent received (any app)
2. **Task**:
   - Extract shared text/image from `%CLIP` or intent extras
   - URL-encode the content
   - Launch URL: `obsidian://cortex?text={encoded_text}&image={encoded_image_path}`

For text-only shares: `obsidian://cortex?text={content}&submit=true`
For image shares: `obsidian://cortex?image={path}` (no auto-submit — user adds context note)

### Homescreen Shortcut

A simple Android homescreen shortcut pointing to `obsidian://cortex` (no params). Opens the Cortex view ready for input. User creates this manually via Android's "Add to Home Screen" for the Obsidian app, or via a Tasker shortcut widget.

---

## 7. Mobile-Specific UX

### Layout Adaptation

Detect mobile via `Platform.isMobile`. Key differences:

| Element | Desktop | Mobile |
|---------|---------|--------|
| Input area position | Top of view | Bottom of view (thumb-reachable) |
| Submit button | Right side of input, or Enter key | Large button below textarea |
| Image button | Icon next to textarea | Prominent button, 44px+ |
| Touch targets | Standard | Minimum 44px height/width |
| Checkbox size | Default | Larger (44px tap area via padding) |

### CSS Strategy

Use `body.is-mobile` class (injected by Obsidian) for mobile-specific overrides. All colors from CSS variables. Layout uses flexbox for easy reordering.

```css
/* Mobile: move input to bottom */
body.is-mobile .cortex-container {
  flex-direction: column-reverse;
}
```

### Mobile Image Button

On mobile, the image attachment button should be visually prominent — not a tiny icon. A filled button with an icon and "Add Image" text, minimum 44px height. Tapping it opens the system file picker with `image/*` filter.

---

## 8. Settings

### Settings Interface

```typescript
interface CortexSettings {
  captureFile: string;       // default: '_Cortex.md'
  prependNew: boolean;       // default: true
  showTimestamps: boolean;   // default: false
  timestampFormat: string;   // default: 'YYYY-MM-DD HH:mm'
}
```

### Settings Tab

A standard `PluginSettingTab` with four fields:
1. **Capture file path** — text input, validates that the path ends in `.md`
2. **Prepend new items** — toggle
3. **Show timestamps** — toggle
4. **Timestamp format** — text input, shown only when timestamps enabled

### First Run

If the capture file doesn't exist when the plugin loads, create it as an empty file. No first-run wizard — just sensible defaults.

---

## 9. Build Configuration

### package.json Dependencies

- `obsidian` — type definitions (peer dependency, not bundled)
- `typescript` — compiler
- `@types/node` — Node type definitions for development
- `esbuild` — bundler

### esbuild Configuration

Standard Obsidian plugin esbuild setup: bundle `main.ts` to `main.js`, external `obsidian`, target `es2018`, format `cjs`. Output: `main.js` alongside `manifest.json` and `styles.css`.

### manifest.json

```json
{
  "id": "cortex-capture",
  "name": "Cortex 2.0",
  "version": "1.0.0",
  "minAppVersion": "1.5.7",
  "description": "Quick capture checklist with image support",
  "author": "Aragorn Meulendijks",
  "isDesktopOnly": false
}
```

`isDesktopOnly: false` — this plugin runs on mobile.
`minAppVersion: 1.5.7` — required for `getAvailablePathForAttachment()`.

---

## 10. Post-Build Integration

### Cortex Cron Update (Must Ship Together)

The `cortex-cron.sh` script currently processes plain text lines in `_Cortex.md`. After this plugin, the file format changes to checkbox markdown. **The cron update must ship simultaneously with the plugin** — if the plugin ships first, the cron breaks on the new checkbox format.

The updated cron needs to:
- Parse `- [ ] text` lines (unchecked = unprocessed)
- Skip `- [x] text` lines (already processed)
- Handle `![[image]]` embeds in items (pass image path to Claude for vision analysis)
- Mark items as `[x]` after processing them into projects/todos/notes
- Periodically remove `[x]` items older than 7 days (configurable) to prevent list bloat

### Checked-Item Lifecycle

1. User captures item → `- [ ]` (unchecked)
2. Cron processes it into a project, todo, or note → marks as `- [x]`
3. Cron removes `[x]` items older than threshold (default: 7 days)
4. User can also manually check off items they've handled themselves

### Migration

One-time conversion of existing `_Cortex.md` content:
- Read each non-empty line
- Prepend `- [ ] ` if it doesn't already have checkbox syntax
- Write back

### Installation

Copy the built plugin (`manifest.json`, `main.js`, `styles.css`) to `.obsidian/plugins/cortex-capture/` in the vault. Enable in Obsidian settings. Obsidian Sync distributes it to all machines.

### Tasker Setup Documentation

Include setup instructions in the plugin's README:
1. Install Tasker on Android
2. Create profile: Intent Received → share intent
3. Create task: extract shared content → format URI → launch URL
4. Test with a screenshot share

---

## 11. Edge Cases and Error Handling

| Scenario | Handling |
|----------|----------|
| Capture file doesn't exist | Create empty file on plugin load |
| Capture file is empty | Show empty checklist with input area ready |
| File modified during view render | Debounced re-render (300ms) |
| Concurrent toggle + sync write | Use `vault.process()` for atomic operations |
| Image save fails | Show `Notice` with error, proceed with text-only item |
| URI handler called while view is open | Reuse existing view, populate input |
| URI handler called while Obsidian is closed | Obsidian opens, plugin loads, handler fires |
| Very long item text | CSS word-wrap, no truncation |
| Malformed checkbox line in file | Preserve as-is, don't render as checkbox item |
| 200+ items performance | Start simple. Add windowing only if measured lag. |

---

## 12. Deliberate v1 Omissions

These features are explicitly **not** included in v1. They may be added later based on usage:

- **Edit item text from UI** — must open `_Cortex.md` in editor to edit. Capture-only in v1.
- **Delete item from UI** — no swipe-to-delete. Items are removed by the cron or manual file editing.
- **Multi-line items** — items are single-line. Newlines stripped on submit.
- **Tag/label system** — no tags, colors, or categories. Plain checklist.
- **Search/filter** — no filtering within the Cortex view.
- **Android `content://` URI handling** — Tasker must pass file paths, not content URIs. If scoped storage causes issues, address in v1.1.
- **Drag-and-drop reordering** — items stay in insertion order.

---

## 13. Testing

### Unit Tests (vitest)

`CortexFile.ts` is pure logic with no Obsidian API dependencies in its core functions. Test with vitest:

- **Parsing**: Verify checkbox regex handles `[ ]`, `[x]`, `[X]`, indented lines, empty text, embedded images, non-checkbox lines
- **Prepend**: Verify new item appears at top, existing content preserved, timestamp formatting correct
- **Toggle**: Verify `[ ]` ↔ `[x]` flip at correct line index, other lines untouched
- **Image embed extraction**: Verify `![[filename.png]]` patterns extracted correctly from item text

### Manual Testing

- Desktop: paste image, drag-drop image, Enter to submit, checkbox toggle, file watcher (edit file externally)
- Mobile: file picker, submit button, checkbox toggle, responsive layout
- URI handler: `obsidian://cortex`, `obsidian://cortex?text=hello`, `obsidian://cortex?text=hello&submit=true`
- Cross-platform: verify same file renders correctly on all devices after sync
- Theme: test with default dark, default light, and at least one community theme
