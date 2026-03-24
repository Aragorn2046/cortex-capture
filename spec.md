# Cortex 2.0 — Obsidian Plugin Spec

## Overview

An Obsidian plugin that provides a checklist-based quick capture view for rapid idea dumping with inline image support. Replaces the current `_Cortex.md` plain-text workflow with a proper UI. Named "Cortex 2.0".

**Primary use case**: User is on the go (Android phone) or busy with other work (desktop). Needs to dump an idea, screenshot, or reminder as fast as possible without context-switching. Opens Cortex, types/pastes, done.

## Requirements Source

Full requirements and interview transcript:
- `../requirements.md` — original (overscoped) requirements
- `../deep_project_interview.md` — interview that refined scope significantly

## User Context

- **Aragorn Meulendijks** — runs Obsidian vault across 3 machines (Dawn/Windows, Dusk/Windows, Day/macOS) + Android phone
- **Current workflow**: `_Cortex.md` in vault root — flat text file where ideas are dumped, then processed by a Claude cron job (`cortex-cron.sh`) every few hours
- **Pain points**: No image support, no visual separation between items, no way to mark items as processed, appending to bottom is inconvenient
- **Primary capture device**: Android phone (on the go)
- **Secondary**: Desktop (Mac/Windows) when working on other projects

## Core Feature: Checklist View

### The View

A custom Obsidian `ItemView` that renders a single markdown file as an interactive checklist.

**Layout (top to bottom)**:
1. **Input area** (top, always visible) — text field + image attachment button. Submit adds a new checkbox item at the TOP of the list.
2. **Checklist items** — each item is a standard markdown checkbox: `- [ ] text content` with optional embedded images `![[image.png]]`
3. Items are rendered with:
   - Clickable checkbox (toggle checked/unchecked)
   - Text content (rendered markdown — bold, italic, links)
   - Inline image thumbnails (if item has embedded images)
   - Timestamp (from when it was captured — stored in the text or as metadata)

### File Format

The backing file is standard Obsidian markdown. Example:

```markdown
- [ ] Just had an idea about the podcast format — what if we do live reactions to breaking news? ![[screenshot-2026-03-22.png]]
- [ ] Remember to ask Patrick about the ABN AMRO timeline
- [x] Check the vault MCP server status on Day
- [ ] Article idea: "Why every CEO needs a Chief Robotics Officer" — tie into the Unitree keynote
```

**Critical constraint**: The file must remain readable and editable as plain markdown. No custom syntax, no frontmatter required on items, no JSON blocks. If the user opens it in a text editor, it's just a checkbox list.

### New Item Flow

1. User focuses the input field (or starts typing)
2. User types text, optionally pastes/drops an image
3. User submits (Enter on desktop, tap button on mobile)
4. A new `- [ ] ` line is **prepended** to the file (newest at top)
5. If image was attached: saved to vault attachment folder, embedded as `![[filename]]` in the item
6. Input field clears, ready for next capture

### Image Handling

- **Desktop**: Paste from clipboard (Ctrl/Cmd+V in input field), drag-and-drop onto input field
- **Mobile**: Tap image button → Obsidian's native file picker (camera, gallery, files)
- **Storage**: Use `app.vault.createBinary()` to save image to vault's configured attachment folder
- **Embedding**: Standard `![[filename.png]]` wikilink syntax
- **Display**: Render thumbnail in the checklist item (CSS max-width, not actual thumbnail generation)
- **Multiple images per item**: Supported — each gets its own embed

### Checkbox Interaction

- Tap/click checkbox → toggles `- [ ]` ↔ `- [x]` in the file
- Checked items stay in place (don't move to bottom) — the user and Claude handle cleanup
- The file is the source of truth — every UI interaction writes back to the file immediately

## Mobile UX

- **Responsive layout**: Single column on phone (<600px), comfortable on tablet and desktop
- **Touch targets**: All interactive elements minimum 44px
- **Input position**: Bottom-anchored on mobile (thumb-reachable), top on desktop
- **No hover-dependent UI**: Everything works with tap
- **Pull-to-refresh**: Not needed — file watcher handles updates
- **Swipe gestures**: Nice-to-have, not required for v1

## Android Integration

### Homescreen Shortcut

Register a URI handler: `obsidian://cortex` → opens the Cortex view directly.

User creates an Android homescreen shortcut pointing to this URI. One tap from homescreen → Cortex is open and ready for input.

### Share Intent

When user shares content from another app to Obsidian on Android:
- Obsidian's share handler receives the content
- Plugin intercepts/routes it to the Cortex file
- Content becomes a new `- [ ]` item at the top
- Shared images are saved to attachment folder and embedded
- Shared text becomes the item text
- Shared URLs become a markdown link in the item

**Note**: Obsidian Mobile's share intent handling may have limitations. Research the actual Obsidian Plugin API capabilities for intercepting shared content. If direct interception isn't possible, the Obsidian URI scheme (`obsidian://new?vault=...&content=...&prepend=true`) may be the fallback approach.

## Desktop UX

- **Open via**: Ribbon icon, command palette ("Cortex: Open capture view"), or hotkey (user-configurable via Obsidian's hotkey settings)
- **Keyboard flow**: Open → cursor in input → type → Enter to submit → continue typing or Escape to close
- **Paste images**: Ctrl/Cmd+V in the input field

## Settings

Minimal. Standard Obsidian plugin settings tab.

| Setting | Default | Description |
|---------|---------|-------------|
| Capture file | `_Cortex.md` | Path to the capture file (relative to vault root) |
| Prepend new items | `true` | Add new items at top (true) or bottom (false) |
| Show timestamps | `false` | Add timestamp to each captured item |
| Timestamp format | `YYYY-MM-DD HH:mm` | Format for timestamps if enabled |

## Plugin Structure

```
cortex-capture/
├── manifest.json        # Plugin metadata (id, name, version, minAppVersion)
├── main.ts              # Plugin class: onload(), onunload(), settings, commands, URI handler
├── src/
│   ├── CortexView.ts    # Custom ItemView — the checklist UI
│   ├── CortexFile.ts    # File operations — read, prepend, toggle checkbox, parse items
│   ├── ImageHandler.ts  # Image paste/drop/pick — save to vault, return embed link
│   └── settings.ts      # Settings tab and defaults
├── styles.css           # All CSS — responsive, theme-aware, mobile-friendly
├── package.json         # Dev dependencies (obsidian, typescript, esbuild)
├── tsconfig.json        # TypeScript config
└── esbuild.config.mjs   # Build script
```

## Technical Constraints

- **Obsidian Plugin API only** — no `require('fs')`, no `require('electron')`, no `window.require()`
- **Cross-platform**: Must work on Obsidian Desktop (Mac, Windows, Linux) and Mobile (Android, iOS)
- **Sync-safe**: File writes must be atomic. Use `app.vault.modify()` or `app.vault.process()` — not direct fs writes
- **Theme-aware CSS**: Use Obsidian CSS variables (`--text-normal`, `--background-primary`, etc.) — no hardcoded colors
- **Performance**: Must handle 200+ items without lag. Consider virtual scrolling if needed, but start simple.
- **Minimum Obsidian version**: 1.5.0+ (for stable Plugin API and mobile feature parity)

## Existing Obsidian Plugin API Reference

Key APIs the plugin will use (to be researched during /deep-plan):
- `Plugin` — base class, `onload()`, `addCommand()`, `addRibbonIcon()`, `registerView()`
- `ItemView` — custom view class, `getViewType()`, `getDisplayText()`, `onOpen()`, `onClose()`
- `Vault` — `read()`, `modify()`, `process()`, `createBinary()`, `getAbstractFileByPath()`
- `FileManager` — `getNewFileParent()` for attachment folder
- `registerObsidianProtocolHandler()` — for `obsidian://cortex` URI
- `workspace.getLeaf()` — open the view in a new leaf
- `debounce()` — for file write batching
- Mobile: `Platform.isMobile` — detect mobile for layout adjustments

## Post-Build Integration

After the plugin is built:
1. **Cortex cron update**: `cortex-cron.sh` may need updating if the file format changes (currently expects plain text in `_Cortex.md`, new format is checkbox markdown)
2. **Migration**: Convert existing `_Cortex.md` content to checkbox format (simple: prepend `- [ ] ` to each non-empty line)
3. **Installation**: Copy to `.obsidian/plugins/cortex-capture/` on all machines + Android
4. **Android shortcut**: Create homescreen shortcut to `obsidian://cortex`
5. **Vault docs**: Update Knowledge Base with plugin documentation

## Success Criteria

1. Open Cortex on Android → type idea → tap submit → item appears at top with checkbox → under 2 seconds total
2. Paste screenshot on desktop → embedded inline with text → image visible in checklist
3. Share image from Android gallery to Obsidian → appears as new Cortex item with image embedded
4. Check off item → file updated → syncs to other machines → checked state preserved
5. Open `_Cortex.md` in a text editor → perfectly readable standard markdown checkbox list
6. Works with any Obsidian theme (dark/light) without visual issues
