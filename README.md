# Cortex 2.0

A quick-capture checklist view for Obsidian with image support, Android integration via URI handler, and cron-compatible checkbox format. Replaces the plain-text `_Cortex.md` workflow with a proper UI — mobile-first, cross-platform.

## Installation

1. Build the plugin:
   ```bash
   npm run build
   ```
2. Copy `manifest.json`, `main.js`, and `styles.css` to your vault:
   ```
   <vault>/.obsidian/plugins/cortex-capture/
   ```
3. Enable in Obsidian: Settings > Community Plugins > Cortex 2.0

## Usage

Open the Cortex view via the brain icon in the ribbon or the command palette ("Cortex: Open capture view"). Type an idea and press Enter (or tap Capture). Attach images via paste, drag-and-drop, or the image button. Check items off when processed.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Capture file path | `_Cortex.md` | Vault-relative path to the capture file |
| Prepend new items | `true` | New items go to the top |
| Show timestamps | `false` | Prepend timestamp to each item |
| Timestamp format | `YYYY-MM-DD HH:mm` | Format string for timestamps |

## URI Handler

Open Cortex programmatically with `obsidian://cortex`:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `text` | Pre-fill the input | `?text=my+idea` |
| `image` | Attach an image from path | `?image=/path/to/img.png` |
| `submit` | Auto-submit without manual tap | `?submit=true` |

Examples:
- `obsidian://cortex` — just open the view
- `obsidian://cortex?text=Remember+this&submit=true` — capture instantly
- `obsidian://cortex?text=Photo+note&image=/path/to/photo.jpg` — text + image

## Android Homescreen Shortcut

Long-press home screen > Add shortcut > URL shortcut > `obsidian://cortex`

## Tasker Integration (Android Share Intent)

1. Install Tasker
2. Create Profile: Event > Intent Received > Action: `android.intent.action.SEND`
3. Create Task:
   - Variable Set: `%SHARED_TEXT` from `%CLIP` or intent extras
   - Variable Search Replace: URL-encode `%SHARED_TEXT`
   - Launch URL: `obsidian://cortex?text=%SHARED_TEXT&submit=true`

For image shares, use `%INTENT_EXTRASTREAM` for the image path. Note: `content://` URIs may need Tasker's "Copy File" action to save to a readable path first.

## Sync Conflict Warning

Concurrent captures from two offline devices can create an Obsidian Sync conflict file. The conflict preserves any items that would be lost. Review conflict files if they appear.

## Cron Integration

The file format is standard checkbox markdown. The external `cortex-cron.sh` processes `- [ ]` items and marks them `- [x]` when done. Old checked items are periodically removed.

## Migration

If you have an existing plain-text `_Cortex.md`, run the migration script before enabling the plugin:

```bash
VAULT_PATH=/path/to/vault bash scripts/migrate-cortex.sh
```

This converts plain text lines to `- [ ] line` format. A backup is created at `_Cortex.md.bak`.
