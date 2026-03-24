# Cortex 2.0 — Research Findings

## Topic 1: Obsidian Plugin API for Custom Views (ItemView)

### Core Architecture

Custom views extend `ItemView` (abstract, extends `View`). Identified by a unique string constant, registered during plugin load.

**Required methods:**
- `getViewType()` — unique string identifier
- `getDisplayText()` — shown in tab header
- `onOpen()` — build DOM in `this.contentEl`
- `onClose()` — cleanup listeners, timers

**Full ItemView API surface:**
- `contentEl` — primary container (always use this, NOT `containerEl.children[1]`)
- `icon` — since v1.1.0
- `navigation` — since v0.15.1, whether view participates in navigation history
- `scope` — register hotkeys scoped to this view
- `addAction(icon, title, callback)` — since v1.1.0, adds icon buttons to view header
- `getState()` / `setState()` — serializable state for workspace.json persistence
- `getEphemeralState()` / `setEphemeralState()` — non-persisted transient state
- `onResize()` — called when leaf is resized
- Inherited from Component: `register()`, `registerEvent()`, `registerDomEvent()`, `registerInterval()`

### Registering and Opening Views

```typescript
// Register in onload()
this.registerView(VIEW_TYPE, (leaf) => new CortexView(leaf));

// Open: reuse existing leaf or create new
async activateView() {
  const leaves = workspace.getLeavesOfType(VIEW_TYPE);
  if (leaves.length > 0) {
    workspace.revealLeaf(leaves[0]);
    return;
  }
  const leaf = workspace.getRightLeaf(false);
  await leaf.setViewState({ type: VIEW_TYPE, active: true });
  workspace.revealLeaf(leaf);
}

// Cleanup in onunload()
this.app.workspace.detachLeavesOfType(VIEW_TYPE);
```

### Critical Best Practices
- Never store direct references to view instances — access via `getLeavesOfType()`
- Use `contentEl`, NOT `containerEl.children[1]` (unstable in newer versions)
- Wrap layout-dependent init in `workspace.onLayoutReady()`
- Always call `detachLeavesOfType()` in `onunload()`

---

## Topic 2: Mobile Share Intent Handling

### Key Finding: Plugins CANNOT intercept raw Android share intents

Android share intents go to Obsidian's core app, not plugins. The plugin-accessible surface is the **`obsidian://` URI scheme**.

### URI Scheme

```
obsidian://<action>?<parameters>
```

Built-in actions: `open`, `new`, `daily`, `search`. Custom actions via:

```typescript
this.registerObsidianProtocolHandler('cortex', (params) => {
  // obsidian://cortex?text=hello&image=path
  // params = { action: 'cortex', text: 'hello', image: 'path' }
});
```

### Practical Share Intent Pattern

Since plugins can't intercept share intents directly, the workflow is:
1. User shares to Obsidian → Obsidian handles natively (creates/appends to note)
2. OR: Use **Tasker** (Android automation) to intercept share → format `obsidian://cortex?content=...` URI → launch Obsidian with that URI
3. OR: Use `obsidian://new?vault=42&file=_Cortex&content=...&prepend=true` (built-in, no plugin needed for basic capture)

The **obsidian-advanced-uri** plugin extends this significantly (append to specific note, execute commands, etc.).

### Limitations
- `registerObsidianProtocolHandler` works on both desktop and mobile
- `paneType=window` is desktop-only
- `x-callback-url` returns are desktop-only
- Values in URL must be percent-encoded

---

## Topic 3: Image Handling in Plugins

### Two Patterns

**Pattern A — Post-creation hook:** Let Obsidian handle paste normally, react to `vault.on('create')`. Simpler but only works in standard editor.

**Pattern B — Direct intercept (needed for custom ItemView):** Attach DOM event listeners to `contentEl`:

```typescript
async onOpen() {
  this.registerDomEvent(this.contentEl, 'paste', this.handlePaste.bind(this));
  this.registerDomEvent(this.contentEl, 'drop', this.handleDrop.bind(this));
  this.registerDomEvent(this.contentEl, 'dragover', (e) => e.preventDefault());
}
```

### Saving Images — The Key API (v1.5.7+)

```typescript
async saveImage(file: File): Promise<TFile> {
  const arrayBuffer = await file.arrayBuffer();
  const timestamp = moment().format('YYYYMMDDHHmmss');
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const filename = `capture-${timestamp}.${ext}`;

  // Respects user's configured attachment folder
  const attachmentPath = await this.app.fileManager.getAvailablePathForAttachment(
    filename,
    this.settings.captureFile  // context: the associated note
  );

  return await this.app.vault.createBinary(attachmentPath, arrayBuffer);
}
```

`getAvailablePathForAttachment()` handles: correct folder resolution, parent directory creation, filename deduplication.

### CRITICAL: Mobile Image Limitations

**Clipboard paste of images does NOT work on Obsidian Mobile** — OS restricts clipboard binary access. On mobile, use a file picker:

```typescript
if (Platform.isMobile) {
  const input = contentEl.createEl('input', {
    type: 'file',
    attr: { accept: 'image/*', capture: 'environment' }
  });
  input.addEventListener('change', async () => {
    if (input.files?.[0]) await this.saveImage(input.files[0]);
  });
}
```

---

## Topic 4: Cross-Platform Plugin Patterns

### Platform Detection

```typescript
import { Platform } from 'obsidian';
Platform.isMobileApp    // iOS or Android
Platform.isDesktopApp   // Electron
Platform.isAndroidApp   // Android only
Platform.isIosApp       // iOS only
```

Use `Platform` (static) for production code, `app.isMobile` for emulation-aware testing.

### APIs NOT Available on Mobile

| Unavailable | Use Instead |
|---|---|
| `require('fs')` | `app.vault.read()`, `app.vault.modify()`, `app.vault.createBinary()` |
| `require('path')` | `normalizePath()` from obsidian |
| `require('electron')` | Platform guards or web APIs |
| `Buffer` | `ArrayBuffer`, `Uint8Array` |
| `addStatusBarItem()` | Returns null on mobile — guard with null check |
| `paneType=window` | Not supported on mobile |

### Theme-Aware CSS Variables

```css
/* Text */
--text-normal, --text-muted, --text-faint, --text-on-accent, --text-accent

/* Backgrounds */
--background-primary, --background-secondary, --background-primary-alt
--background-modifier-hover, --background-modifier-border

/* Interactive */
--interactive-normal, --interactive-hover, --interactive-accent

/* Typography */
--font-text-theme, --font-interface-theme, --font-text-size

/* Layout */
--radius-s, --radius-m, --radius-l
--border-width
```

### Mobile-Specific CSS

```css
body.is-mobile .cortex-container { /* mobile styles */ }
body.is-desktop .cortex-container { /* desktop styles */ }
body.theme-dark .cortex-container { /* dark theme */ }
body.theme-light .cortex-container { /* light theme */ }
```

Touch targets: minimum 44x44px (WCAG / Material Design standard, matches Obsidian's own mobile UI).

### Desktop Emulation for Testing

```typescript
app.emulateMobile(true);   // enable
app.emulateMobile(false);  // disable
```

Android device debugging: USB Debugging + `chrome://inspect`. iOS: macOS Web Inspector.

### Common Pitfalls
1. `require('fs')` / `require('electron')` crash on mobile — always guard
2. `addStatusBarItem()` returns null on mobile
3. Regex lookbehind breaks on iOS < 16.4
4. Desktop emulation is imperfect — always test on real devices

---

## Testing Recommendations (New Project)

- **Framework**: No standard testing framework for Obsidian plugins. Most plugins use manual testing.
- **Automated**: Consider `vitest` for unit testing pure logic (file parsing, checkbox toggling) — mock the Obsidian API.
- **E2E**: Use `app.emulateMobile(true)` for desktop-based mobile testing, real device testing for final verification.
- **Key test scenarios**: Checkbox toggle, image save/embed, prepend behavior, URI handler, mobile file picker, theme compatibility.

---

## Sources

- [Official Views Documentation](https://publish-01.obsidian.md/access/caa27d6312fe5c26ebc657cc609543be/Plugins/User+interface/Views.md)
- [ItemView API Reference](https://publish-01.obsidian.md/access/caa27d6312fe5c26ebc657cc609543be/Reference/TypeScript+API/ItemView.md)
- [Obsidian URI Official Docs](https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/Extending%20Obsidian/Obsidian%20URI.md)
- [registerObsidianProtocolHandler API](https://publish-01.obsidian.md/access/caa27d6312fe5c26ebc657cc609543be/Reference/TypeScript+API/Plugin/registerObsidianProtocolHandler.md)
- [Mobile Development Docs](https://publish-01.obsidian.md/access/caa27d6312fe5c26ebc657cc609543be/Plugins/Getting+started/Mobile+development.md)
- [CSS Variables Reference](https://docs.obsidian.md/Reference/CSS+variables/CSS+variables)
- [obsidian-paste-image-rename](https://github.com/reorx/obsidian-paste-image-rename)
- [obsidian-advanced-uri](https://github.com/Vinzent03/obsidian-advanced-uri)
