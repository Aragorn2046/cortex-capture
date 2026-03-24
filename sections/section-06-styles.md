# section-06-styles

## Overview

This section covers the complete CSS for the Cortex 2.0 Obsidian plugin. A single file — `styles.css` — handles all visual styling: theme-aware colors, responsive layout switching for mobile, touch target sizing, image thumbnail display, the input area, and checklist appearance. No TypeScript or logic here; this section is purely CSS.

**Dependency**: Requires section-01-project-setup to be complete (directory structure and build config in place). Parallelizable with sections 02, 03, and 05.

**Blocks**: section-07-integration (final wiring and testing).

---

## File to Create

`/Users/aragorn/projects/cortex-capture/01-cortex-capture/styles.css`

This file is referenced by the build process and must sit at the project root alongside `manifest.json` and `main.js`. Obsidian loads it automatically when the plugin is enabled.

---

## Tests

All style tests are manual (CSS cannot be unit tested with vitest). The test checklist covers layout, theme, and touch target compliance.

### Mobile Layout Tests

```
// Test: input area appears at bottom on mobile (body.is-mobile class applied)
// Test: input area appears at top on desktop (default flex order)
// Test: layout is single-column full-width on phone screen
```

### Touch Target Tests

```
// Test: all buttons meet 44px minimum touch target on mobile
// Test: checkbox tap area is 44px+ on mobile (via padding, not element resize)
// Test: image button is visually prominent on mobile — not a tiny icon
```

### Theme Tests

```
// Test: works with Obsidian dark theme (no hardcoded colors visible)
// Test: works with Obsidian light theme
// Test: works with a popular community theme (e.g., Minimal)
```

### Visual Regression Tests (manual)

```
// Test: image thumbnails render inline with item text, constrained by max-width
// Test: image preview in input area shows thumbnail with an 'x' remove button
// Test: textarea grows with content (auto-resize behavior)
// Test: long item text wraps, is not truncated
```

---

## Implementation Details

### Approach

All colors and spacing must use Obsidian CSS variables (e.g., `--background-primary`, `--text-normal`, `--interactive-accent`) so the plugin respects the user's chosen theme, including community themes. No hardcoded color values.

Obsidian injects `body.is-mobile` for mobile devices. Use this class to override layout and sizing without any JavaScript involvement in styling decisions.

Flexbox is the primary layout tool — it allows easy reordering of the input area (column-reverse on mobile flips it to the bottom).

### Key CSS Blocks to Implement

#### Container and Main Layout

The view's root element inside `contentEl` should have a class like `.cortex-container`. On desktop it is a vertical flex column with the input area at the top and the checklist scrolling below. On mobile, `flex-direction: column-reverse` moves the input to the bottom.

```css
/* Desktop default */
.cortex-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* ... */
}

/* Mobile: move input to bottom */
body.is-mobile .cortex-container {
  flex-direction: column-reverse;
}
```

#### Input Area

The input area contains the textarea, the image attachment button, the image preview zone, and the submit button. On desktop the submit button can sit to the right of the textarea. On mobile, it should be a large block-level button below the textarea with a minimum height of 44px.

Style the textarea to auto-resize (this requires a small JS trick in `CortexView.ts` — the CSS sets `resize: none; overflow: hidden` and JS adjusts `height` on input). The placeholder text should use `--text-muted`.

#### Submit Button

Minimum 44px height on mobile. Use `--interactive-accent` for the background and `--text-on-accent` for the text to match the theme's call-to-action color.

#### Image Attachment Button

On mobile, this should be a visually prominent button (not just an icon) with label text like "Add Image". Minimum 44px height. On desktop, it can be a smaller icon button.

#### Image Preview (in input area)

When an image is staged for submission, a thumbnail preview appears in the input area. Keep it small: `max-width: 120px; max-height: 120px`. Position a small circular "×" remove button in the top-right corner of the preview. Use `position: relative` on the preview wrapper and `position: absolute` on the remove button.

#### Checklist Items

Each checklist item is a flex row: `[checkbox] [text/images]`. Align items to the start (top) so long text and multi-thumbnail items don't center-align oddly.

On mobile, increase the checkbox tap area using padding rather than changing the checkbox element size. A CSS approach:

```css
body.is-mobile .cortex-item input[type="checkbox"] {
  width: 44px;
  height: 44px;
  /* Use appearance:none and custom styling if needed for consistent sizing */
}
```

#### Image Thumbnails in Checklist Items

Images embedded in checklist items (`![[filename.png]]`) are rendered as `<img>` elements in `CortexView.ts`. Constrain their size in CSS:

```css
.cortex-item-image {
  max-width: 200px;
  max-height: 150px;
  border-radius: 4px;
  cursor: pointer; /* for potential lightbox in future */
  display: block;
  margin-top: 4px;
}
```

#### Checked Items

Checked items (`- [x]`) should visually indicate their processed state. Use `opacity: 0.5` or `text-decoration: line-through` on the text span, referencing `--text-muted`.

#### Scrollable Checklist

The checklist container should be `overflow-y: auto; flex: 1` so it takes up remaining space and scrolls independently of the input area. The input area should never scroll off screen.

### CSS Variables to Use

Pull from Obsidian's built-in variable set. Common ones:

| Purpose | Variable |
|---|---|
| Page background | `--background-primary` |
| Secondary background (items, panels) | `--background-secondary` |
| Normal text | `--text-normal` |
| Muted text (placeholders, checked items) | `--text-muted` |
| Accent color (submit button bg) | `--interactive-accent` |
| Accent text (submit button text) | `--text-on-accent` |
| Border/divider | `--background-modifier-border` |
| Interactive hover | `--background-modifier-hover` |

### Dark and Light Theme Support

Because all colors use CSS variables, dark/light theme support is automatic. No `prefers-color-scheme` media query needed — Obsidian handles theme switching by updating the variable values. Do not add any hardcoded theme-conditional blocks.

### CSS Class Naming Convention

Use a `.cortex-` prefix for all plugin-specific classes to avoid conflicts with Obsidian's own styles or other plugins:

- `.cortex-container` — main wrapper
- `.cortex-input-area` — input zone (textarea + buttons)
- `.cortex-textarea` — the text input
- `.cortex-submit-btn` — submit button
- `.cortex-image-btn` — image attachment button
- `.cortex-image-preview` — staged image preview in input area
- `.cortex-image-preview-remove` — the "×" button on the preview
- `.cortex-list` — the scrollable checklist container
- `.cortex-item` — individual checklist item row
- `.cortex-item-text` — text span within an item
- `.cortex-item-image` — image thumbnail within an item

### Responsive Considerations

The plugin runs on desktop (tab in main workspace, any width) and on mobile (full-screen). There is no minimum width constraint. The layout must be functional at 320px (minimum phone width).

Do not use fixed pixel widths on any container. Use `width: 100%` and let flexbox handle distribution.

---

## Summary of What to Build

1. Create `styles.css` at `/Users/aragorn/projects/cortex-capture/01-cortex-capture/styles.css`
2. Define all `.cortex-*` class rules using Obsidian CSS variables
3. Implement the mobile layout override using `body.is-mobile .cortex-container { flex-direction: column-reverse }`
4. Set 44px minimum touch targets for buttons and checkboxes under `body.is-mobile`
5. Style image thumbnails (in checklist items and in the input preview area)
6. Style checked items as visually dimmed or struck through
7. Ensure the checklist scrolls independently (`flex: 1; overflow-y: auto`) while the input area stays fixed
8. No hardcoded colors anywhere — CSS variables only