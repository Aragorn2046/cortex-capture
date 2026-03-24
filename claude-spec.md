# Cortex 2.0 — Complete Specification

## What We're Building

An Obsidian plugin called **Cortex 2.0** that replaces the existing `_Cortex.md` plain-text inbox with an interactive checklist view. The plugin provides a fast capture interface for dumping ideas, screenshots, and reminders with minimal friction across Android phone, macOS, and Windows.

## User Profile

Aragorn Meulendijks runs an Obsidian vault synced across 3 machines (Dawn/Windows WSL2, Dusk/Windows WSL2, Day/macOS) and an Android phone. His primary capture device is the Android phone — used on the go for quick idea dumps and screenshots. Desktop capture happens when he's busy with other work and wants to quickly record something without context-switching.

## Current Workflow & Pain Points

**Current**: `_Cortex.md` in vault root. Plain text file. Ideas appended as free text. A Claude cron job (`cortex-cron.sh`) processes items every few hours into projects, todos, or full notes.

**Pain points**:
- No image support — can't dump screenshots
- No visual separation between items
- No way to mark items as processed
- New items go to the bottom (inconvenient — latest should be on top)
- No dedicated capture UI — just editing a raw markdown file

## Core Design: Interactive Checklist

### The View

A custom Obsidian `ItemView` registered as `cortex-view`, opening as a **tab** in the main workspace area (full-screen on mobile).

**Layout**:
1. **Input area** (top on desktop, bottom on mobile for thumb reach) — text field + image attachment button + submit button
2. **Checklist** — scrollable list of checkbox items, newest at top

### File Format

Single markdown file (`_Cortex.md` by default). Standard checkbox syntax:

```markdown
- [ ] Just had an idea about the podcast format ![[capture-20260324143052.png]]
- [ ] Remember to ask Patrick about the ABN AMRO timeline
- [x] Check the vault MCP server status on Day
- [ ] Article idea: "Why every CEO needs a Chief Robotics Officer"
```

**Critical constraint**: File must remain readable/editable as plain markdown. No custom syntax, no required frontmatter, no JSON blocks.

### New Item Flow

1. User types text in input field
2. Optionally attaches image (file picker on mobile, paste/drop on desktop)
3. Submits (tap button on mobile, Enter on desktop)
4. New `- [ ] text ![[image]]` line prepended to file
5. Input clears, ready for next capture

### Checkbox Interaction

- Tap/click toggles `- [ ]` ↔ `- [x]`
- Checked items stay in place (Claude cron handles cleanup)
- File is source of truth — every toggle writes back immediately

## Image Handling

### Desktop (Mac/Windows)
- **Clipboard paste**: Ctrl/Cmd+V in input field — intercept paste event, extract image, save to vault
- **Drag-and-drop**: Drop image onto input area
- **API**: DOM `paste`/`drop` events on `contentEl` → `vault.createBinary()` → embed as `![[filename]]`

### Mobile (Android)
- **In-app**: File picker button (`<input type="file" accept="image/*">`) — tap to open camera/gallery
- **Share from gallery** (PRIMARY path): Take screenshot → Share → Tasker intercepts → sends `obsidian://cortex?image=<encoded_path>&text=<optional>` → plugin handles URI, opens Cortex view with image pre-attached, cursor in text field for context note
- **Clipboard paste**: NOT available on Obsidian Mobile (OS restriction on binary clipboard)

### Image Storage
- Use `app.fileManager.getAvailablePathForAttachment(filename, cortexFilePath)` (v1.5.7+)
- Respects user's configured attachment folder
- Handles filename deduplication automatically
- Filename pattern: `capture-YYYYMMDDHHmmss.ext`
- Embed as standard `![[filename.png]]` wikilink

### User Typically Adds Context
Screenshots usually come with a line of text explaining what it's about. The UI should make it natural to add text alongside an image — not require separate actions.

## Android Integration

### Tasker Share Automation (One-Time Setup)

The plugin registers a custom URI handler:
```typescript
this.registerObsidianProtocolHandler('cortex', (params) => {
  // params: { text?: string, image?: string }
});
```

Tasker profile: intercept share intent → format `obsidian://cortex?text=<content>&image=<path>` → launch. Plugin receives the URI, opens the Cortex view, and creates a new item with the shared content.

**Tasker setup will be documented** as part of the plugin's README. One-time configuration.

### Homescreen Shortcut

Android homescreen shortcut pointing to `obsidian://cortex` → opens Cortex view directly. One tap from homescreen to capture interface.

## Desktop Integration

- **Ribbon icon**: Cortex icon in left sidebar ribbon
- **Command palette**: "Cortex: Open capture view"
- **Hotkey**: User-configurable via Obsidian's hotkey settings (plugin registers the command, user assigns the key)
- **Keyboard flow**: Open → cursor in input → type → Enter to submit → continue or Escape

## View Implementation

### Opening the View
```
activateView():
  1. Check if cortex-view leaf already exists → revealLeaf()
  2. If not, workspace.getLeaf(true) → setViewState({ type: 'cortex-view' }) → revealLeaf()
```

On mobile this gives a full-screen view. On desktop it opens as a new tab.

### View Lifecycle
- `onOpen()`: Build DOM, load file content, render checklist, set up event listeners
- `onClose()`: Clean up listeners (handled automatically by `registerDomEvent`)
- File watcher: `registerEvent(vault.on('modify', ...))` to update view when file changes externally (sync, other plugins, Claude cron)

### DOM Structure
```
contentEl
├── .cortex-input-area
│   ├── .cortex-text-input (textarea)
│   ├── .cortex-image-button (file picker trigger)
│   ├── .cortex-image-preview (thumbnail of attached image, hidden when empty)
│   └── .cortex-submit-button
├── .cortex-checklist
│   ├── .cortex-item
│   │   ├── input[type=checkbox]
│   │   ├── .cortex-item-text (rendered markdown)
│   │   └── .cortex-item-images (thumbnail strip)
│   ├── .cortex-item
│   └── ...
```

## Mobile UX

- **Responsive**: Single column, full width
- **Touch targets**: All interactive elements minimum 44px
- **Input position**: Bottom-anchored on mobile (`body.is-mobile`) for thumb reach, top on desktop
- **No hover-dependent UI**: Everything works with tap
- **File picker styling**: Large, obvious image button — not a tiny icon

## Settings

Standard Obsidian plugin settings tab. Minimal.

| Setting | Default | Description |
|---------|---------|-------------|
| Capture file | `_Cortex.md` | Path to the capture file (relative to vault root) |
| Prepend new items | `true` | New items at top (true) or bottom (false) |
| Show timestamps | `false` | Add timestamp to captured items |
| Timestamp format | `YYYY-MM-DD HH:mm` | Format string for timestamps |

## Plugin Structure

```
cortex-capture/
├── manifest.json          # id: cortex-capture, minAppVersion: 1.5.7
├── main.ts                # Plugin class: onload/onunload, registerView, commands, URI handler
├── src/
│   ├── CortexView.ts      # ItemView subclass — the checklist UI
│   ├── CortexFile.ts      # File ops: read, prepend item, toggle checkbox, parse items
│   ├── ImageHandler.ts    # Save images to vault, generate embed links, handle paste/drop/pick
│   └── settings.ts        # Settings interface, defaults, settings tab
├── styles.css             # All CSS — responsive, theme-aware, mobile-optimized
├── package.json           # obsidian, typescript, @types/node, esbuild
├── tsconfig.json
└── esbuild.config.mjs
```

## Technical Constraints

- **Obsidian Plugin API only** — no `require('fs')`, no `require('electron')`, no `window.require()`
- **Cross-platform**: Desktop (Mac, Windows, Linux) + Mobile (Android, iOS)
- **Sync-safe**: Use `app.vault.modify()` or `app.vault.process()` for atomic writes
- **Theme-aware CSS**: Use Obsidian CSS variables (`--text-normal`, `--background-primary`, etc.)
- **Performance**: Handle 200+ items. Start simple, add virtual scrolling only if needed.
- **Minimum Obsidian**: 1.5.7 (for `getAvailablePathForAttachment`)

## Key API Usage

| Need | API |
|------|-----|
| Register view | `this.registerView(type, factory)` |
| Open view | `workspace.getLeaf()` → `setViewState()` → `revealLeaf()` |
| Read file | `vault.read(file)` or `vault.cachedRead(file)` |
| Write file | `vault.modify(file, newContent)` or `vault.process(file, fn)` |
| Save image | `vault.createBinary(path, arrayBuffer)` |
| Attachment path | `fileManager.getAvailablePathForAttachment(name, source)` |
| URI handler | `registerObsidianProtocolHandler('cortex', handler)` |
| Platform detect | `Platform.isMobile`, `Platform.isDesktopApp` |
| DOM events | `registerDomEvent(el, event, handler)` (auto-cleanup) |
| File events | `registerEvent(vault.on('modify', handler))` |
| Ribbon icon | `addRibbonIcon(icon, title, callback)` |
| Command | `addCommand({ id, name, callback })` |
| Cleanup | `workspace.detachLeavesOfType(type)` in `onunload()` |

## Post-Build Integration

1. **Cortex cron**: Update `cortex-cron.sh` to parse checkbox markdown format (currently plain text)
2. **Migration**: Convert existing `_Cortex.md` content — prepend `- [ ] ` to each non-empty line
3. **Install**: Copy `manifest.json`, `main.js`, `styles.css` to `.obsidian/plugins/cortex-capture/` on all machines + Android
4. **Tasker**: Document and set up share-to-Cortex automation on Android
5. **Homescreen**: Create Android shortcut to `obsidian://cortex`
6. **Vault docs**: Update Knowledge Base

## Success Criteria

1. **Android capture < 3 seconds**: Screenshot → Share → Tasker → Cortex opens with image → type note → submit
2. **Desktop capture < 2 seconds**: Open Cortex → type → Enter → done
3. **Image embed works**: Pasted/shared images visible as thumbnails in checklist, stored in vault attachments
4. **Checkbox toggle**: Tap checkbox → file updated → syncs to other machines → state preserved
5. **Plain markdown**: Open `_Cortex.md` in any text editor → readable checkbox list with image embeds
6. **Theme-aware**: Works with any Obsidian theme (dark/light), no visual issues
7. **Mobile-first**: Large touch targets, thumb-reachable input, responsive layout
