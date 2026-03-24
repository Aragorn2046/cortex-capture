# Section 07 — Integration, Testing, Migration, and Release

## Overview

This is the final section of the Cortex 2.0 implementation. All other sections must be complete before this one begins:

- **section-01**: Project scaffolding (manifest.json, package.json, tsconfig.json, esbuild.config.mjs)
- **section-02**: `src/CortexFile.ts` — parsing, prepend, toggle
- **section-03**: `src/ImageHandler.ts` — image saving, embed strings
- **section-04**: `src/CortexView.ts` — ItemView DOM, event handlers, file watcher
- **section-05**: `main.ts` — plugin entry point, commands, URI handler
- **section-06**: `styles.css` — theme-aware responsive CSS

This section covers: end-to-end manual testing on desktop and mobile, URI handler verification, cross-platform sync testing, updating `cortex-cron.sh` to handle the new checkbox format, a one-time migration script for existing `_Cortex.md` content, Tasker setup documentation, and the final README.

---

## File Paths

All paths are relative to the plugin project root at `/Users/aragorn/projects/cortex-capture/01-cortex-capture/`:

- `migrate-cortex.ts` — one-time migration script (standalone Node script, not bundled into plugin)
- `scripts/migrate-cortex.sh` — shell wrapper to run the migration
- `README.md` — user-facing documentation including Tasker setup
- `/home/arago/scripts/cortex-cron.sh` — existing cron script that must be updated (lives outside the plugin repo)

The built plugin artifacts (`manifest.json`, `main.js`, `styles.css`) are copied to:
```
/home/arago/vault/.obsidian/plugins/cortex-capture/
```

---

## Tests

### Unit Tests — Run with `npx vitest run`

The unit tests from section-02 (CortexFile) and section-03 (ImageHandler) should already be passing. Before shipping, confirm all pass:

```bash
npx vitest run
```

Expected: all tests in `src/CortexFile.test.ts` and `src/ImageHandler.test.ts` pass with zero failures.

### Manual Test Checklist — Desktop

Work through this list in order. Each test assumes the plugin is installed and enabled in Obsidian.

**Basic Capture**
- [ ] Ribbon icon opens the Cortex view as a tab
- [ ] Command palette "Cortex: Open capture view" opens the view
- [ ] If view is already open, it reuses the existing leaf (no duplicate tabs)
- [ ] Input textarea has focus when view opens
- [ ] Type text, press Enter → item appears at top of checklist, input clears
- [ ] Submit button click also creates item
- [ ] Escape key clears input and image preview

**Checkbox Toggle**
- [ ] Click checkbox on an item → item shows as checked (strikethrough or visual indicator)
- [ ] Click checked item → unchecks it
- [ ] Verify the actual `_Cortex.md` file reflects the toggle (open file in editor)

**Image — Clipboard Paste**
- [ ] Copy an image to clipboard (screenshot, etc.)
- [ ] Ctrl+V in the textarea → thumbnail preview appears in input area
- [ ] "x" button on preview removes the attachment
- [ ] Submit with image attached → item appears with `![[capture-timestamp.png]]` embed
- [ ] Image file exists in vault attachment folder
- [ ] Thumbnail renders inline next to item text in the checklist

**Image — Drag and Drop**
- [ ] Drag an image file from Finder/Explorer onto the input area
- [ ] Same result as clipboard paste: thumbnail preview, saved on submit

**File Watcher**
- [ ] With Cortex view open, manually edit `_Cortex.md` in a separate Obsidian tab
- [ ] Cortex view refreshes automatically (within ~300ms debounce)
- [ ] Self-modifications (submit, toggle) do NOT cause visible re-render flicker

**Theme Testing**
- [ ] Default dark theme — all elements readable, no invisible text
- [ ] Default light theme — all elements readable
- [ ] At least one community theme (Minimal recommended) — layout intact

### Manual Test Checklist — Mobile (Android)

Install the plugin on Android (Obsidian Sync distributes the plugin files).

**Layout**
- [ ] Input area appears at the bottom of the view (not the top)
- [ ] Checklist items scroll above the input area
- [ ] All buttons are at least 44px tall (easy to tap)
- [ ] Checkboxes have 44px+ tap area (padding, not just the checkbox itself)

**Basic Capture**
- [ ] Tap submit button → item created
- [ ] Keyboard "Done" or return key submits

**Image — File Picker**
- [ ] Tap image button → system file picker opens
- [ ] File picker offers both gallery and camera options
- [ ] Select from gallery → thumbnail preview shown
- [ ] Take photo with camera → thumbnail preview shown
- [ ] Submit with image → item created with embed, image saved in vault

### Manual Test Checklist — URI Handler

Open a terminal or browser address bar and test each URI. On macOS use `open "obsidian://cortex?..."`, on Android use an intent.

- [ ] `obsidian://cortex` — opens Cortex view (no params)
- [ ] `obsidian://cortex?text=hello+world` — opens view with "hello world" pre-filled in input
- [ ] `obsidian://cortex?text=autosave&submit=true` — item created automatically, no manual tap
- [ ] `obsidian://cortex?text=note&image=/absolute/path/to/img.png` — text and image both pre-filled
- [ ] `obsidian://cortex?image=/path/to/img.png&submit=true` — image saved, item auto-submitted
- [ ] URI with percent-encoded characters (e.g., `%20`, `%26`) — decoded correctly
- [ ] URI called while view is already open → reuses view, populates input (does not open second tab)

**Critical**: The `submit=true` + `image` combination must wait for the async image save to complete before submitting. If the item submits before the image save resolves, the embed string will be missing. Test this explicitly.

### Manual Test Checklist — Cross-Platform Sync

These tests verify that a single `_Cortex.md` file works correctly across all devices.

- [ ] Capture item on Android → sync → item visible on desktop with correct checkbox state
- [ ] Check item on desktop → sync → shows as checked on Android
- [ ] Paste image on desktop → sync → image thumbnail visible on Android (requires image file to also sync)
- [ ] `_Cortex.md` remains valid markdown after all operations (open in any markdown editor and confirm it renders)
- [ ] No sync conflict files created during normal single-device usage

---

## cortex-cron.sh Update

**This update must ship at the same time as the plugin.** If the plugin ships first, the cron breaks on the new checkbox format. If the cron ships first, it breaks on the old plain-text format. Ship both together in a single coordinated step.

### What Changes

The existing `cortex-cron.sh` at `/home/arago/scripts/cortex-cron.sh` processes `_Cortex.md` as plain text lines. After the plugin is deployed, the file format becomes checkbox markdown:

```
- [ ] Unprocessed idea from Android
- [ ] Another capture ![[capture-20260324-143022.png]]
- [x] Already processed item
```

### Required Changes to the Cron Script

Open `/home/arago/scripts/cortex-cron.sh` and make these updates:

1. **Line parsing**: Change the item-reading logic to filter for `- [ ]` lines only (unchecked = unprocessed). Skip `- [x]` lines.

2. **Image embed handling**: When a `- [ ] ` line contains `![[filename]]`, extract the filename and pass the resolved vault path to Claude for vision analysis. The attachment folder follows the vault's configured attachment path.

3. **Mark processed**: After promoting an item to a project/todo/note, update the line in `_Cortex.md` from `- [ ]` to `- [x]`. Use an atomic read-modify-write approach (same as `vault.process()` pattern — in shell this means: read file, substitute the specific line, write back).

4. **Cleanup pass**: After processing, remove `- [x]` items that are older than the configured threshold (default 7 days). Since the file has no per-line timestamps by default, use the item's position as a proxy (checked items near the bottom are older) OR enable timestamps in plugin settings and parse the `[YYYY-MM-DD HH:mm]` prefix to determine age.

5. **Non-checkbox lines**: Preserve them as-is (headers, blank lines, any notes the user may have added directly).

### Cron Update Manual Tests

After updating the cron script:

- [ ] Run cron manually: confirm it reads `- [ ]` items and ignores `- [x]` items
- [ ] After cron runs on an item, confirm that item is now `- [x]` in `_Cortex.md`
- [ ] Cron handles `![[image]]` embeds without crashing (even if vision analysis is a stub)
- [ ] Old `- [x]` items are removed after the configured threshold
- [ ] Non-checkbox lines (headers, blanks) are preserved untouched

---

## Migration Script

This is a one-time script to convert any existing content in `_Cortex.md` from plain text to checkbox format. Run it once, before enabling the plugin for the first time.

### File: `migrate-cortex.ts`

```typescript
/**
 * One-time migration: converts plain text lines in _Cortex.md to checkbox format.
 *
 * For each non-empty line that doesn't already have checkbox syntax,
 * prepend `- [ ] `. Lines that already start with `- [ ]` or `- [x]` are left unchanged.
 * Blank lines are preserved.
 *
 * Usage:
 *   npx ts-node migrate-cortex.ts /path/to/vault/_Cortex.md
 *   # or with the shell wrapper:
 *   bash scripts/migrate-cortex.sh
 */

import fs from 'fs';
import path from 'path';

function migrateContent(content: string): string {
  // Returns migrated content string.
  // Each line: if blank, keep as-is. If already checkbox, keep as-is. Otherwise prepend `- [ ] `.
}

function main() {
  // Read file path from argv[2].
  // Read content, migrate, write back (atomic: write to temp file, rename).
  // Print summary: N lines converted, M lines already in checkbox format.
}

main();
```

The migration is non-destructive: lines already in checkbox format are untouched. Blank lines are preserved. A backup copy of the original file should be written to `_Cortex.md.bak` before modifying.

### File: `scripts/migrate-cortex.sh`

```bash
#!/usr/bin/env bash
# Wrapper to run the migration script against the vault's _Cortex.md.
# Edit VAULT_PATH below before running.

VAULT_PATH="/home/arago/vault"
CORTEX_FILE="$VAULT_PATH/_Cortex.md"

if [ ! -f "$CORTEX_FILE" ]; then
  echo "No _Cortex.md found at $CORTEX_FILE"
  exit 1
fi

echo "Backing up $CORTEX_FILE to ${CORTEX_FILE}.bak"
cp "$CORTEX_FILE" "${CORTEX_FILE}.bak"

npx ts-node "$(dirname "$0")/../migrate-cortex.ts" "$CORTEX_FILE"
```

### Migration Manual Tests

- [ ] Run migration on a test file with a mix of: plain text lines, existing `- [ ]` lines, existing `- [x]` lines, blank lines
- [ ] Plain text lines are converted to `- [ ] original text`
- [ ] Existing checkbox lines (`- [ ]` and `- [x]`) are unchanged
- [ ] Blank lines are unchanged
- [ ] Backup file (`_Cortex.md.bak`) is created before modification
- [ ] Run migration a second time on already-migrated file → no changes (idempotent)

---

## README

Create `README.md` at the plugin project root. The README is user-facing and should include:

### Sections to Include

**1. What It Is** — one paragraph describing Cortex 2.0: a quick-capture checklist view for Obsidian with image support, Android integration via URI handler, and cron-compatible checkbox format.

**2. Installation**

```
1. Build: npm run build
2. Copy manifest.json, main.js, styles.css to:
   <vault>/.obsidian/plugins/cortex-capture/
3. Enable in Obsidian: Settings → Community Plugins → Cortex 2.0
```

**3. Usage** — brief description of the UI: open via ribbon icon or command palette, type and press Enter, image attachment, checkbox toggling.

**4. Settings** — table of all settings with defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| Capture file path | `_Cortex.md` | Vault-relative path to the capture file |
| Prepend new items | `true` | New items go to the top |
| Show timestamps | `false` | Prepend `[YYYY-MM-DD HH:mm]` to each item |
| Timestamp format | `YYYY-MM-DD HH:mm` | Format string for timestamps |

**5. URI Handler** — document all supported parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `text` | Pre-fill the input textarea | `?text=my+idea` |
| `image` | Attach an image from a file path | `?image=/path/to/img.png` |
| `submit` | Auto-submit without manual tap | `?submit=true` |

Include example URIs.

**6. Android Homescreen Shortcut** — instructions: long-press home screen → add shortcut → URL shortcut → `obsidian://cortex`.

**7. Tasker Integration**

Step-by-step setup:
1. Install Tasker on Android
2. Create a new Profile: Event → Intent Received → Action: `android.intent.action.SEND`
3. Create the linked Task:
   - Variable Set: `%SHARED_TEXT` from `%CLIP` or intent extras (`%par1` / extras parsing)
   - Variable Search Replace: URL-encode `%SHARED_TEXT` (replace spaces with `+`, special chars with percent-encoding)
   - Launch URL: `obsidian://cortex?text=%SHARED_TEXT&submit=true`
4. Test: share a text snippet from any app → Obsidian opens → item auto-captured

For image shares:
- Use `%INTENT_EXTRASTREAM` for the image path
- Launch URL: `obsidian://cortex?image=%INTENT_EXTRASTREAM`
- Omit `&submit=true` for images — user adds a note before submitting

Note the Android scoped storage caveat: `content://` URIs may not resolve correctly. If the image path starts with `content://`, Tasker's "Copy File" action can save it to a readable path first (e.g., `/storage/emulated/0/Tasker/tmp-image.jpg`), then use that path.

**8. Sync Conflict Warning** — document the known limitation: concurrent captures from two offline devices both modifying the top of the file can create an Obsidian Sync conflict. The conflict file preserves any items that would be lost. Users should review conflict files if they appear.

**9. Cron Integration** — one paragraph explaining that the file format is standard checkbox markdown, the external `cortex-cron.sh` processes `- [ ]` items and marks them `- [x]` when done, and old `- [x]` items are periodically removed.

---

## Installation Steps (Coordinated Deployment)

Deploy in this exact order to avoid breaking the existing Cortex workflow:

1. **Run migration script** (backup `_Cortex.md`, convert to checkbox format)
   ```bash
   bash scripts/migrate-cortex.sh
   ```

2. **Update `cortex-cron.sh`** with the new checkbox-aware parsing logic (before enabling plugin)

3. **Build the plugin**
   ```bash
   npm run build
   ```

4. **Copy to vault**
   ```bash
   cp manifest.json main.js styles.css /home/arago/vault/.obsidian/plugins/cortex-capture/
   ```

5. **Enable in Obsidian** — Settings → Community Plugins → Enable "Cortex 2.0"

6. **Verify** — run the manual test checklist (desktop first, then mobile after sync)

7. **Test cron** — run `cortex-cron.sh` manually once to confirm it processes the migrated format correctly

---

## Edge Cases to Verify Before Shipping

These come from the implementation plan and must be explicitly confirmed:

| Scenario | How to Verify |
|----------|--------------|
| Capture file doesn't exist on fresh install | Delete `_Cortex.md`, reload plugin, confirm file created empty |
| URI `submit=true` + image — async ordering | Use a slow disk or add a short delay in ImageHandler to confirm the embed is present in the submitted item |
| `getResourcePath()` on mobile | Open Cortex view on Android with an item that has an image embed, confirm `<img>` tag renders (not broken image) |
| 200+ items performance | Add 250 items to `_Cortex.md`, open the view, measure render time — should be under 500ms |
| Concurrent toggle + external sync write | Edit file in a second Obsidian window while toggling in Cortex view — no data loss |
| Malformed lines in `_Cortex.md` | Add lines like `- [y] text` and `- [] text` — confirm they render as plain text, not broken checkboxes |