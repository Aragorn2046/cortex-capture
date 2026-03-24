# Cortex 2.0 — TDD Plan

Testing framework: **vitest** for unit tests on pure logic modules. Manual testing for Obsidian-specific UI and integration.

Test files live alongside source files: `src/CortexFile.test.ts`, etc.

---

## 3. CortexFile — File Parsing and Manipulation

### Parsing Tests

```typescript
// Test: parses unchecked item `- [ ] hello` → { checked: false, text: 'hello' }
// Test: parses checked item `- [x] done` → { checked: true, text: 'done' }
// Test: parses uppercase checked `- [X] done` → { checked: true, text: 'done' }
// Test: parses item with image embed `- [ ] idea ![[img.png]]` → images: ['img.png']
// Test: parses item with multiple images `- [ ] text ![[a.png]] ![[b.jpg]]` → images: ['a.png', 'b.jpg']
// Test: parses indented item `  - [ ] indented` → { checked: false, text: 'indented' }
// Test: preserves non-checkbox lines (headers, blank lines) as-is
// Test: handles empty text after checkbox `- [ ] ` → { text: '' }
// Test: handles empty file → returns empty array
// Test: handles file with only non-checkbox content → returns no items, preserves content
```

### Prepend Tests

```typescript
// Test: prepend to empty file → file contains single checkbox line
// Test: prepend to file with existing items → new item at top, existing items preserved
// Test: prepend with image embed → line includes ![[filename]]
// Test: prepend with timestamp enabled → line includes formatted timestamp
// Test: prepend strips newlines from input text (multi-line → single-line)
// Test: prepend with empty text but image → creates item with just image embed
```

### Toggle Tests

```typescript
// Test: toggle unchecked item → becomes [x], other lines unchanged
// Test: toggle checked item → becomes [ ], other lines unchanged
// Test: toggle by line index → correct line modified
// Test: toggle preserves item text and image embeds
// Test: toggle at invalid line index → content unchanged (no crash)
```

### Timestamp Formatting Tests

```typescript
// Test: default format 'YYYY-MM-DD HH:mm' produces correct output
// Test: custom format string produces correct output
// Test: no moment dependency — uses native Date
```

---

## 4. CortexView — The Checklist UI

### Manual Tests

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

---

## 5. ImageHandler — Cross-Platform Image Support

### Unit Tests

```typescript
// Test: generates filename with timestamp pattern `capture-YYYYMMDDHHmmss.ext`
// Test: determines correct extension from MIME type (image/png → png, image/jpeg → jpg)
// Test: returns correct embed string format `![[filename.ext]]`
```

### Manual Tests

```
// Desktop:
// Test: Ctrl/Cmd+V with image in clipboard → image saved, preview shown
// Test: Ctrl/Cmd+V with text in clipboard → normal paste (no image handling)
// Test: drag image file onto input area → image saved, preview shown
// Test: click "x" on image preview → image attachment removed

// Mobile:
// Test: tap image button → system file picker opens
// Test: select image from gallery → image saved, preview shown
// Test: take photo with camera → image saved, preview shown
// Test: image saved in correct attachment folder (per Obsidian settings)
```

---

## 6. URI Handler and Android Integration

### Manual Tests

```
// Test: obsidian://cortex (no params) → opens Cortex view
// Test: obsidian://cortex?text=hello → opens view with "hello" in input
// Test: obsidian://cortex?text=hello&submit=true → creates item automatically
// Test: obsidian://cortex?image=/path/to/img.png → opens view with image attached
// Test: obsidian://cortex?text=note&image=/path/to/img.png → both text and image
// Test: obsidian://cortex?image=/path&submit=true → waits for image save before submit
// Test: URI with percent-encoded characters decodes correctly
// Test: URI called while view already open → reuses view, populates input
```

---

## 7. Mobile-Specific UX

### Manual Tests

```
// Test: input area appears at bottom on mobile (body.is-mobile)
// Test: input area appears at top on desktop
// Test: all buttons meet 44px minimum touch target
// Test: checkbox tap area is 44px+ on mobile
// Test: image button is visually prominent on mobile (not tiny icon)
// Test: layout is single-column full-width on phone screen
```

---

## 8. Settings

### Manual Tests

```
// Test: changing capture file path switches to new file
// Test: capture file created automatically if it doesn't exist
// Test: toggling timestamps on/off affects new items (not existing)
// Test: settings persist across Obsidian restart
```

---

## 10. Post-Build Integration

### Manual Tests

```
// Test: migration script converts plain text lines to checkbox format
// Test: migration preserves existing checkbox lines unchanged
// Test: updated cron parses checkbox format correctly
// Test: cron marks processed items as [x]
// Test: cron removes old [x] items
// Test: cron handles ![[image]] embeds in items
```

---

## Cross-Platform Integration Tests

```
// Test: create item on Android → syncs to desktop → visible with correct checkbox state
// Test: check item on desktop → syncs to Android → shows as checked
// Test: paste image on desktop → syncs to Android → image thumbnail visible
// Test: file remains valid markdown after all operations
// Test: works with Obsidian dark theme
// Test: works with Obsidian light theme
// Test: works with a popular community theme (e.g., Minimal)
```
