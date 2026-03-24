# Integration Notes — Opus Review

## Integrating

1. **vault.process() for ALL writes** — Correct. Prepend must also use `vault.process()`. Fixing.
2. **Multi-line contradiction** — Removing Shift+Enter. Items are single lines. Simpler, matches current Cortex workflow (one idea per line). Newlines in input get stripped to spaces on submit.
3. **Self-modification exclusion** — Good catch. Adding `ignoreNextModify` flag pattern.
4. **Sync conflict acknowledgment** — Adding a note. Obsidian Sync's last-write-wins is acceptable for this use case.
5. **Testing plan** — Adding basic testing section for CortexFile pure logic.
6. **Parsed edge cases** — Accepting uppercase [X], trimming leading whitespace.
7. **No delete/edit stated explicitly** — Adding as deliberate v1 omission.
8. **Checked-item lifecycle** — Documenting: cron marks items as [x] after processing, then removes [x] items periodically.
9. **URI auto-submit must await image save** — Adding async sequencing note.
10. **Accessibility basics** — Adding ARIA roles.
11. **Timestamp: use simple formatter** — No moment dependency, simple Date formatting.

## NOT Integrating

1. **Android content:// URI handling** — This is a real concern but overcomplicates v1. The Tasker task will be configured to copy the image to a known location (e.g., `/storage/emulated/0/Pictures/CortexCapture/`) before passing the path. Document this in the Tasker setup instructions. If content:// proves necessary, add in v1.1.
2. **Settings migration warning** — Over-engineering for v1. The setting is a text field. If you change it, the old file stays. Not worth the complexity.
3. **Verify getResourcePath on mobile** — This is an implementation-time verification, not a plan-time decision. Note it as a risk.
4. **Verify getAvailablePathForAttachment signature** — Same, implementation-time check.
5. **esbuild target note** — We don't use lookbehind in our regex. Not adding complexity for a hypothetical.
6. **getLeaf(true) behavior** — Plan already says "new tab". The implementation will test on current Obsidian.
