<!-- PROJECT_CONFIG
runtime: typescript-npm
test_command: npx vitest run
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-project-setup
section-02-cortex-file
section-03-image-handler
section-04-cortex-view
section-05-plugin-main
section-06-styles
section-07-integration
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-project-setup | - | all | Yes |
| section-02-cortex-file | 01 | 04, 05, 07 | Yes |
| section-03-image-handler | 01 | 04, 05, 07 | Yes |
| section-04-cortex-view | 01, 02, 03 | 05, 07 | No |
| section-05-plugin-main | 01, 02, 03, 04 | 07 | No |
| section-06-styles | 01 | 07 | Yes |
| section-07-integration | all | - | No |

## Execution Order

1. **section-01-project-setup** (no dependencies)
2. **section-02-cortex-file**, **section-03-image-handler**, **section-06-styles** (parallel after 01)
3. **section-04-cortex-view** (after 02 AND 03)
4. **section-05-plugin-main** (after 04)
5. **section-07-integration** (final — wiring, testing, migration)

## Section Summaries

### section-01-project-setup
Project scaffolding: manifest.json, package.json, tsconfig.json, esbuild.config.mjs, directory structure, vitest config. No implementation code — just the skeleton.

### section-02-cortex-file
Pure logic module: `src/CortexFile.ts` + `src/CortexFile.test.ts`. Parsing checkbox markdown, prepending items, toggling checkboxes, timestamp formatting. TDD: write all parser/prepend/toggle tests first, then implement.

### section-03-image-handler
Image handling module: `src/ImageHandler.ts`. Save images to vault via `createBinary()`, resolve attachment paths via `getAvailablePathForAttachment()`, generate filenames, return embed strings. Desktop paste/drop, mobile file picker. Platform-aware code paths.

### section-04-cortex-view
The ItemView subclass: `src/CortexView.ts`. DOM structure (input area, checklist), event handlers (submit, checkbox toggle, paste, drop), file watcher with debounce and self-modification exclusion, responsive layout detection, image preview in input area.

### section-05-plugin-main
Plugin entry point: `main.ts`. View registration, ribbon icon, command palette, URI handler (`obsidian://cortex`), settings loading, `onload()`/`onunload()` lifecycle, `activateView()` logic.

### section-06-styles
All CSS: `styles.css`. Theme-aware variables, responsive layout (mobile column-reverse), touch target sizing, image thumbnails, input area styling, checkbox sizing, dark/light theme support. Uses `body.is-mobile` class for mobile overrides.

### section-07-integration
Final wiring and testing: end-to-end manual testing on desktop + mobile, URI handler testing, cross-platform sync verification, cortex-cron.sh update for checkbox format, migration script for existing _Cortex.md, Tasker setup documentation, README.
