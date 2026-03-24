# Opus Review

**Model:** claude-opus-4-6
**Generated:** 2026-03-24

---

## Overall Assessment

Well-structured, well-researched plan. Clean module decomposition, correct file-as-source-of-truth principle. Several gaps and risks worth addressing.

## Must Fix

1. **Race condition in prepend** — Use `vault.process()` for ALL writes, not just toggle. Prepend currently uses `vault.modify()` which is vulnerable to sync overwrites.
2. **Multi-line item contradiction** — Section 4 supports Shift+Enter for newlines but Section 3 only parses single-line items. Pick one: either strip newlines on submit or define continuation line format.
3. **Android `content://` URI handling** — Tasker may pass `content://` URIs instead of file paths on Android 10+. Plugin needs to handle this or document workaround.
4. **Cortex cron sequencing** — Cron currently expects plain text. If plugin ships before cron update, cron breaks. Sequence explicitly.

## Should Address

5. **Self-modification exclusion in file watcher** — User action writes file → triggers watcher → redundant re-render. Use `ignoreNextModify` flag.
6. **Verify `getResourcePath()` works in custom views on mobile** — Plan doesn't confirm image URL generation works cross-platform in ItemView.
7. **Verify `getAvailablePathForAttachment` signature for v1.5.7** — API signature may expect TFile, not string.
8. **Sync conflict acknowledgment** — 4 devices, all prepending to same file region. Document expected behavior.
9. **Testing plan** — CortexFile.ts is pure logic, trivially testable. Add at least parser/toggler/timestamp tests.

## Nice to Have

10. **Accessibility** — ARIA roles on custom DOM elements (`role="list"`, `role="listitem"`).
11. **Settings migration** — Warn user or migrate items when capture file path changes.
12. **Checked-item lifecycle** — Document what happens to `[x]` items over time (cron removes? archives?).
13. **Timestamp formatting** — Don't rely on `moment` (deprecated in Obsidian). Simple formatter or document limitations.
14. **Parsing edge cases** — Handle indented items, uppercase `[X]`, empty text after checkbox.
15. **URI auto-submit race** — `submit=true` with image must wait for async image save.
16. **`getLeaf(true)` behavior** — Confirm this opens a tab (not split) in recent Obsidian versions. Consistent with intent.
17. **No delete/edit from UI** — Deliberate v1 omission but should be stated explicitly.
18. **esbuild target** — Note iOS regex lookbehind constraint alongside `es2018` target.
