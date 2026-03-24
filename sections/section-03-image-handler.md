# Section 03: Image Handler

## Overview

This section implements `src/ImageHandler.ts` — the module responsible for all image input paths in the Cortex 2.0 plugin. It handles clipboard paste (desktop), drag-and-drop (desktop), and file picker (mobile), converging all paths onto a single save function that writes to the Obsidian vault and returns an embed string.

**Dependencies:**
- `section-01-project-setup` must be complete (TypeScript/esbuild scaffold, vitest config, package.json with `obsidian` types)
- This section can be implemented in parallel with `section-02-cortex-file` and `section-06-styles`
- `section-04-cortex-view` and `section-05-plugin-main` depend on this section being complete

**File to create:** `/Users/aragorn/projects/cortex-capture/01-cortex-capture/src/ImageHandler.ts`
**Test file to create:** `/Users/aragorn/projects/cortex-capture/01-cortex-capture/src/ImageHandler.test.ts`

---

## Tests First

Write the unit tests in `src/ImageHandler.test.ts` before implementing. These are the testable pure-logic functions — the Obsidian API calls (`vault.createBinary`, `fileManager.getAvailablePathForAttachment`) are not tested via unit tests; they require manual testing.

### Unit Tests (vitest)

```typescript
// src/ImageHandler.test.ts

// Test: generateFilename() produces pattern `capture-YYYYMMDDHHmmss.ext`
//   - Given a Date object and extension 'png', output matches /^capture-\d{14}\.png$/
//   - Given a Date object and extension 'jpg', output matches /^capture-\d{14}\.jpg$/
//   - The 14-digit segment encodes YYYYMMDDHHMMSS correctly (parseable back to the input date)

// Test: mimeToExt() returns correct extension from MIME type
//   - 'image/png'  → 'png'
//   - 'image/jpeg' → 'jpg'
//   - 'image/gif'  → 'gif'
//   - 'image/webp' → 'webp'
//   - 'image/heic' → 'heic'
//   - unknown MIME type → 'png' (safe fallback)

// Test: makeEmbedString() returns correct Obsidian embed format
//   - Given filename 'capture-20260324143000.png' → '![[capture-20260324143000.png]]'
//   - Given filename with spaces → embed string includes the filename as-is (Obsidian handles it)
```

The test file should import these three helper functions directly. They are pure (no Obsidian API, no DOM) and fully unit-testable with vitest.

### Manual Tests

These require a live Obsidian environment and are documented here for the integration phase:

**Desktop clipboard paste:**
- `Ctrl/Cmd+V` with an image in clipboard → image saved to vault attachments folder, preview thumbnail appears in input area
- `Ctrl/Cmd+V` with text in clipboard → normal paste behavior, no image handling triggered
- The image attachment button on desktop → opens same flow as paste (or shows a visual cue for drag-and-drop)

**Desktop drag-and-drop:**
- Drag an image file from Finder/Explorer onto the input area → image saved, preview shown
- Drag a non-image file → ignored (no error, no visual disruption)

**Mobile file picker:**
- Tap image button → system file picker opens with image/* filter (shows both gallery and camera options on Android)
- Select image from gallery → image saved to vault attachments folder, preview shown
- Take a photo with camera → image saved, preview shown
- Image saved to correct attachment folder per Obsidian's attachment settings (not hardcoded path)

**Preview and removal:**
- After attaching an image (any method), thumbnail preview appears in the input area (CSS max-width: 120px)
- Clicking the "x" button on the preview removes the attachment before submit — the embed string is cleared
- Submitting without removing → embed string appended to item text

**Error case:**
- If `vault.createBinary()` fails (simulate by making vault read-only) → Obsidian `Notice` displays the error, text-only capture still works

---

## Implementation Details

### Module Responsibilities

`ImageHandler.ts` is responsible for:
1. Registering DOM event listeners for paste and drag-and-drop (desktop)
2. Wiring up the hidden file input element (mobile)
3. Converting any image input into an `ArrayBuffer`
4. Generating a timestamped filename
5. Resolving the correct vault attachment path
6. Saving the file via `vault.createBinary()`
7. Showing a thumbnail preview in the input area
8. Providing the embed string `![[filename.ext]]` to the caller (stored until submit)

### Class Structure

`ImageHandler` takes the Obsidian `App` instance and references to the relevant DOM elements (the input area container, the preview area element, and the textarea). It exposes:

- A method to register all event listeners (called from `CortexView.ts` during `onOpen()`)
- A getter for the current pending embed string (empty string if no image is attached)
- A method to clear the pending image (called after submit or Escape)

The class uses `app.vault` and `app.fileManager` for vault operations, and accepts the capture file path (needed for `getAvailablePathForAttachment()` to place attachments relative to the correct file).

### Key Helper Functions (export these for unit testing)

```typescript
/** Generates a filename like `capture-20260324143000.png` */
export function generateFilename(date: Date, ext: string): string

/** Maps a MIME type string to a file extension. Returns 'png' as fallback. */
export function mimeToExt(mimeType: string): string

/** Returns the Obsidian embed string for a filename: `![[filename]]` */
export function makeEmbedString(filename: string): string
```

These three functions must be exported (not just internal methods) so the test file can import and test them directly.

### Core Save Logic

The save flow is shared across all input paths (paste, drop, file picker):

1. Receive a `File` object (from clipboard, dataTransfer, or file input)
2. Verify it is an image via `file.type.startsWith('image/')` — skip silently if not
3. Call `mimeToExt(file.type)` to get the extension
4. Call `generateFilename(new Date(), ext)` to produce the filename
5. Call `app.fileManager.getAvailablePathForAttachment(filename, captureFilePath)` to get the vault-relative path (respects Obsidian's attachment folder settings)
6. Read the file as `ArrayBuffer`: `await file.arrayBuffer()`
7. Call `await app.vault.createBinary(attachmentPath, arrayBuffer)`
8. Call `makeEmbedString(filename)` and store it in `this.pendingEmbed`
9. Show the thumbnail preview using `URL.createObjectURL(file)` for the `<img>` src (the object URL is local and immediate — no need to resolve the vault path for preview purposes)
10. On error: catch, show `new Notice(...)` with the error message, do not update `pendingEmbed`

### Desktop: Paste Event

Register on the `<textarea>` element (not the whole document). The handler:
- Checks `event.clipboardData?.files` for any file with an image MIME type
- If found: calls `event.preventDefault()` and invokes the shared save logic
- If no image: lets the default paste behavior proceed (text gets pasted into textarea normally)

Use `registerDomEvent` on the view (passed into `ImageHandler`) so the listener is automatically cleaned up when the view closes. This avoids manual `removeEventListener` calls.

### Desktop: Drag-and-Drop

Register `dragover` and `drop` on the input area container element:
- `dragover`: call `event.preventDefault()` to signal that drops are accepted; optionally add a CSS class for visual feedback
- `drop`: check `event.dataTransfer?.files` for images; if found, call `event.preventDefault()` and invoke the shared save logic

### Mobile: File Input

Create a hidden `<input type="file" accept="image/*">` element (no `capture` attribute — lets user choose gallery or camera). Store a reference to it. The visible image button calls `input.click()` on tap. Register the `change` event on the input element:
- Check `input.files?.[0]`
- If present, invoke the shared save logic

### Preview Element

The preview area is a `<div>` that is hidden by default (`display: none`). After a successful image save:
- Create an `<img>` element with `src = URL.createObjectURL(file)` and set `max-width: 120px` via CSS class
- Create a small `<button>` (the "x" remove button) — clicking it calls `this.clearPendingImage()`
- Set the preview div to visible

`clearPendingImage()` should:
- Set `this.pendingEmbed = ''`
- Clear the preview div's contents and hide it
- Revoke the object URL (call `URL.revokeObjectURL(...)`) to free memory

### Obsidian API Notes

- `app.fileManager.getAvailablePathForAttachment(filename, sourcePath)` — requires Obsidian min version 1.5.7 (already declared in `manifest.json`). The `sourcePath` is the vault-relative path of the capture file (e.g., `_Cortex.md`). Obsidian uses this to determine where to place the attachment based on the user's attachment folder settings.
- `app.vault.createBinary(path, data)` — creates a new binary file at the given vault path. If the file already exists at that path, it will error; `getAvailablePathForAttachment()` handles deduplication by appending a number.
- On mobile, `getResourcePath()` returns an app-specific protocol URL (not `file://`). For the preview, use `URL.createObjectURL()` instead — it works cross-platform without needing to resolve vault paths.

### Risk: `getAvailablePathForAttachment()` on Mobile

During implementation, verify that `app.fileManager.getAvailablePathForAttachment()` returns a valid writable path on Android/iOS. If it behaves differently (e.g., returns a path that `createBinary()` can't write to), the fallback is to use a hardcoded attachments subfolder: `Attachments/capture-{timestamp}.{ext}` and use `app.vault.createFolder()` to ensure it exists. Document the finding either way.

---

## File Path Summary

| File | Action |
|------|--------|
| `src/ImageHandler.ts` | Create — main module |
| `src/ImageHandler.test.ts` | Create — unit tests for `generateFilename`, `mimeToExt`, `makeEmbedString` |

No other files are modified in this section. The `CortexView.ts` (section-04) will import and instantiate `ImageHandler`.

<voice>
Section 03 is done. It covers the ImageHandler module — all three input paths for images, the unit test stubs for the pure helper functions, and the key Obsidian API details to watch out for on mobile. Check the screen for the full content.
</voice>