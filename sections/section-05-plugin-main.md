# Section 05: Plugin Main Entry Point

## Overview

This section implements `main.ts` — the Obsidian plugin entry point that wires together all other modules. It handles plugin lifecycle (`onload`/`onunload`), view registration, ribbon icon, command palette entry, URI handler, and settings loading.

**Dependencies (must be complete before this section):**
- `section-01-project-setup` — project scaffold, `package.json`, `tsconfig.json`, `esbuild.config.mjs`
- `section-02-cortex-file` — `src/CortexFile.ts` with `CortexItem`, parsing, prepend, and toggle functions
- `section-03-image-handler` — `src/ImageHandler.ts` with filename generation and embed string logic
- `section-04-cortex-view` — `src/CortexView.ts` — the `ItemView` subclass
- Settings module — `src/settings.ts` with `CortexSettings` interface and `CortexSettingTab` class

---

## File to Create

**`main.ts`** (project root, alongside `manifest.json`)

---

## Background Context

### What Obsidian Plugins Need

An Obsidian plugin is a class that extends `Plugin` from the `obsidian` package. The default export must be this class. Obsidian calls `onload()` when the plugin is enabled and `onunload()` when it is disabled or Obsidian quits.

Everything registered inside `onload()` using the `Plugin` helper methods (`registerView`, `addRibbonIcon`, `addCommand`, `registerObsidianProtocolHandler`, `addSettingTab`, `registerEvent`) is automatically cleaned up by the framework when `onunload()` runs. This means `onunload()` itself only needs to explicitly clean up things that were **not** registered via these helpers — namely, manually detaching any open `cortex-view` leaves.

### View Type

The view type identifier string is `"cortex-view"`. This constant is used in three places:
1. `registerView("cortex-view", factory)` in `onload()`
2. `workspace.getLeavesOfType("cortex-view")` in `activateView()`
3. Inside `CortexView.ts` as the return value of `getViewType()`

Define it as a named export so `CortexView.ts` can import it: `export const CORTEX_VIEW_TYPE = "cortex-view"`.

### Settings Loading

Settings live in `data.json` in the plugin directory (Obsidian manages this location). Load with `await this.loadData()`, merge with defaults, and store on `this.settings`. Save with `await this.saveData(this.settings)`.

### CortexFile Initialization

On first run (or any time the capture file doesn't exist), create the file as empty. This happens in `onload()` after settings are loaded. Use `app.vault.adapter.exists(captureFilePath)` to check, then `app.vault.create(captureFilePath, "")` to create.

---

## Settings Module (src/settings.ts)

This module is small enough to specify fully. Create `src/settings.ts` alongside `main.ts`:

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
import type CortexPlugin from "../main";

export interface CortexSettings {
  captureFile: string;       // default: '_Cortex.md'
  prependNew: boolean;       // default: true
  showTimestamps: boolean;   // default: false
  timestampFormat: string;   // default: 'YYYY-MM-DD HH:mm'
}

export const DEFAULT_SETTINGS: CortexSettings = {
  captureFile: "_Cortex.md",
  prependNew: true,
  showTimestamps: false,
  timestampFormat: "YYYY-MM-DD HH:mm",
};

export class CortexSettingTab extends PluginSettingTab {
  plugin: CortexPlugin;

  constructor(app: App, plugin: CortexPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    // Four settings:
    // 1. Capture file path (text, validates ends in .md)
    // 2. Prepend new items (toggle)
    // 3. Show timestamps (toggle)
    // 4. Timestamp format (text, shown only when showTimestamps is true)
  }
}
```

---

## main.ts Structure

```typescript
import { Plugin, WorkspaceLeaf } from "obsidian";
import { CortexView } from "./src/CortexView";
import { CortexSettings, DEFAULT_SETTINGS, CortexSettingTab } from "./src/settings";

export const CORTEX_VIEW_TYPE = "cortex-view";

export default class CortexPlugin extends Plugin {
  settings: CortexSettings;

  async onload(): Promise<void> {
    // 1. Load settings (merge loaded data with DEFAULT_SETTINGS)
    // 2. Register the CortexView factory
    // 3. Add ribbon icon
    // 4. Add command palette entry
    // 5. Register URI handler for obsidian://cortex
    // 6. Add settings tab
    // 7. Ensure capture file exists (create empty if not)
  }

  onunload(): void {
    // Detach all cortex-view leaves
  }

  async activateView(): Promise<void> {
    // Reuse existing leaf or create a new one, then reveal
  }

  async loadSettings(): Promise<void> {
    // Load from data.json, merge with defaults
  }

  async saveSettings(): Promise<void> {
    // Save this.settings to data.json
  }
}
```

---

## Implementation Details

### 1. Settings Loading

```typescript
async loadSettings(): Promise<void> {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}
```

Call `await this.loadSettings()` as the first line of `onload()`.

### 2. View Registration

```typescript
this.registerView(
  CORTEX_VIEW_TYPE,
  (leaf: WorkspaceLeaf) => new CortexView(leaf, this)
);
```

`CortexView` receives both the leaf and the plugin instance (which carries `settings` and `app`).

### 3. Ribbon Icon

```typescript
this.addRibbonIcon("pencil", "Open Cortex", () => {
  this.activateView();
});
```

Use any built-in Obsidian icon name. `"pencil"` is appropriate for a capture tool. The second argument is the tooltip text.

### 4. Command Palette

```typescript
this.addCommand({
  id: "open-cortex-view",
  name: "Open capture view",
  callback: () => this.activateView(),
});
```

### 5. URI Handler

```typescript
this.registerObsidianProtocolHandler("cortex", async (params) => {
  await this.activateView();

  // Get the active CortexView leaf
  const leaves = this.app.workspace.getLeavesOfType(CORTEX_VIEW_TYPE);
  if (leaves.length === 0) return;
  const view = leaves[0].view as CortexView;

  // If text param: populate the input
  if (params.text) {
    view.setInputText(decodeURIComponent(params.text));
  }

  // If image param: attach the image (async)
  if (params.image) {
    await view.attachImageFromPath(decodeURIComponent(params.image));
  }

  // If submit=true: auto-submit after image is ready
  if (params.submit === "true") {
    await view.submitItem();
  }
});
```

The `params` object has string values (URI query parameters). All decoding/decoding is handled here before calling view methods. The `CortexView` must expose `setInputText()`, `attachImageFromPath()`, and `submitItem()` as public methods.

### 6. activateView()

```typescript
async activateView(): Promise<void> {
  const { workspace } = this.app;

  // Reuse existing leaf
  const existing = workspace.getLeavesOfType(CORTEX_VIEW_TYPE);
  if (existing.length > 0) {
    workspace.revealLeaf(existing[0]);
    return;
  }

  // Create new leaf in main workspace
  const leaf = workspace.getLeaf(true);
  await leaf.setViewState({ type: CORTEX_VIEW_TYPE, active: true });
  workspace.revealLeaf(leaf);
}
```

`getLeaf(true)` creates a new tab. On mobile this is full-screen. On desktop it appears as a tab in the main workspace area.

### 7. onunload()

```typescript
onunload(): void {
  this.app.workspace.detachLeavesOfType(CORTEX_VIEW_TYPE);
}
```

This closes the Cortex view cleanly when the plugin is disabled.

### 8. Ensure Capture File Exists

After loading settings, check and create the capture file if missing:

```typescript
const adapter = this.app.vault.adapter;
const filePath = this.settings.captureFile;
if (!(await adapter.exists(filePath))) {
  await this.app.vault.create(filePath, "");
}
```

---

## Public Methods CortexView Must Expose

The URI handler calls these three methods on the view instance. They must be declared as `public` in `CortexView.ts` (section-04 dependency):

- `setInputText(text: string): void` — sets the textarea value
- `attachImageFromPath(filePath: string): Promise<void>` — loads file from path, saves to vault, shows preview
- `submitItem(): Promise<void>` — reads current text + pending image, prepends to file, clears input

If `CortexView.ts` does not yet expose these, this section is blocked until section-04 is updated.

---

## Tests

### Unit Tests

`main.ts` is not directly unit-tested (it requires the Obsidian runtime). All pure logic is in `CortexFile.ts` (tested in section-02). The plugin main is covered by manual testing only.

### Manual Tests for This Section

These tests exercise the functionality added in `main.ts`:

```
// Test: ribbon icon appears in left sidebar after plugin loads
// Test: clicking ribbon icon opens Cortex view as a tab
// Test: opening Cortex view a second time reuses the existing leaf (does not open a second tab)
// Test: command palette shows "Cortex: Open capture view"
// Test: selecting the command opens the Cortex view
// Test: obsidian://cortex (no params) → opens Cortex view
// Test: obsidian://cortex?text=hello → opens view with "hello" pre-filled in textarea
// Test: obsidian://cortex?text=hello&submit=true → item auto-submitted, input cleared
// Test: obsidian://cortex?image=/path/to/img.png → opens view with image preview attached
// Test: obsidian://cortex?image=/path&submit=true → waits for image save before submitting
// Test: URI with percent-encoded characters decodes correctly
// Test: URI called while view is already open → reuses view, populates input
// Test: capture file _Cortex.md is created automatically on first plugin load if missing
// Test: settings tab appears in Obsidian settings panel
// Test: changing capture file path in settings takes effect for new captures
// Test: toggling timestamps in settings affects new items (existing items unchanged)
// Test: settings persist across Obsidian restart (reload plugin)
// Test: disabling plugin via settings detaches the Cortex view leaf (onunload)
```

---

## Implementation Checklist

- [ ] Create `src/settings.ts` with `CortexSettings` interface, `DEFAULT_SETTINGS`, and `CortexSettingTab` stub
- [ ] Create `main.ts` with `CORTEX_VIEW_TYPE` named export
- [ ] Implement `loadSettings()` / `saveSettings()` using `loadData()` / `saveData()`
- [ ] Implement `onload()`: settings load, view register, ribbon icon, command, URI handler, settings tab, file existence check
- [ ] Implement `onunload()`: detach leaves
- [ ] Implement `activateView()`: reuse or create leaf, reveal
- [ ] Implement URI handler: parse params, call view public methods in correct async order
- [ ] Verify `CortexView.ts` exposes `setInputText`, `attachImageFromPath`, `submitItem` as public methods (coordinate with section-04 if not yet done)
- [ ] Build: `npm run build` should produce `main.js` with no errors
- [ ] Manual test all URI handler scenarios listed above
- [ ] Manual test ribbon icon and command palette