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

Obsidian plugins cannot add their own entry to Android's share sheet — that's an OS-level feature for native apps. **Tasker** bridges this gap by intercepting share intents and routing them to Cortex 2.0 via the URI handler.

### Why Tasker?

When you share a screenshot or text from any Android app, the share sheet shows "Obsidian" but that only offers "Import to Vault" with no control over destination. Tasker intercepts the share intent *before* Obsidian sees it, extracts the content, and fires `obsidian://cortex` with the right parameters. Result: one-tap capture from any app's share button.

### Setup: Share Images to Cortex (screenshots, photos)

This is the most useful flow — share a screenshot directly into Cortex.

**Step 1: Create the Task (what happens when you share)**

1. Open Tasker > Tasks tab > tap **+** > name it `Cortex Image Capture`
2. Add actions in this order:

| # | Action | Settings |
|---|--------|----------|
| 1 | **Variables > Variable Set** | Name: `%img_uri` — To: `%intent_data`. If %intent_data is empty, use `%intent_extra_stream` |
| 2 | **File > Copy File** | From: `%img_uri` — To: `/storage/emulated/0/Tasker/cortex-share.jpg` — Use Root: Off |
| 3 | **Net > Browse URL** | URL: `obsidian://cortex?image=/storage/emulated/0/Tasker/cortex-share.jpg` |

**Why the copy step?** Android shares images as `content://` URIs which Obsidian can't read directly. Copying to a fixed path on internal storage makes the file accessible to Obsidian's vault adapter.

**Step 2: Create the Profile (when to trigger)**

1. Go to Profiles tab > tap **+**
2. Select **Event > Intent Received**
3. Set:
   - Action: `android.intent.action.SEND`
   - Mime Type: `image/*`
4. Link it to the `Cortex Image Capture` task

**Step 3: Test it**

1. Take a screenshot on your phone
2. Tap **Share** in the screenshot preview
3. Select **Tasker** from the share sheet
4. Obsidian should open with the image attached in Cortex — add a note and tap Capture

### Setup: Share Text to Cortex (URLs, copied text, notes from other apps)

**Step 1: Create the Task**

1. Tasks tab > **+** > name it `Cortex Text Capture`
2. Add actions:

| # | Action | Settings |
|---|--------|----------|
| 1 | **Variables > Variable Set** | Name: `%shared_text` — To: `%intent_extra_text` |
| 2 | **Variables > Variable Search Replace** | Variable: `%shared_text` — Search: ` ` (space) — Replace: `+` — Replace All: On |
| 3 | **Net > Browse URL** | URL: `obsidian://cortex?text=%shared_text&submit=true` |

Note: `submit=true` auto-captures the text immediately. Remove it if you want to review/edit before submitting.

**Step 2: Create the Profile**

1. Profiles tab > **+** > **Event > Intent Received**
2. Set:
   - Action: `android.intent.action.SEND`
   - Mime Type: `text/plain`
3. Link it to the `Cortex Text Capture` task

### Setup: Combined (text + image in one share)

Some apps share both text and an image together (e.g., sharing a tweet with a screenshot). Create a third profile:

1. Profile: Event > Intent Received > Action: `android.intent.action.SEND` > Mime Type: `*/*`
2. Task: combine the image copy step with the text extraction, then:
   ```
   Browse URL: obsidian://cortex?text=%shared_text&image=/storage/emulated/0/Tasker/cortex-share.jpg
   ```
   (Omit `submit=true` so you can review the combined capture before submitting)

**Priority note:** If you have all three profiles, set the `image/*` and `text/plain` profiles to higher priority than the `*/*` fallback so specific types match first.

### Alternative: MacroDroid (free)

If you don't own Tasker, [MacroDroid](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid) can do the same thing for free:

1. Create a Macro with trigger: **Intent Received** (same action and mime type settings)
2. Add action: **Open Website/URL** with the same `obsidian://cortex?...` URL pattern
3. For image shares, use MacroDroid's **Shell Script** action to copy the file first

### Troubleshooting

- **"Tasker" doesn't appear in share sheet**: Open Tasker > Preferences > UI > Show Tasker As Share Destination > On
- **Image not found after share**: Check that `/storage/emulated/0/Tasker/` exists. Create it manually if needed.
- **Obsidian opens but no image appears**: The `content://` URI couldn't be copied. Try changing the copy destination or check Tasker has storage permissions.
- **URL encoding issues with special characters**: For text with `&`, `=`, or `%`, add a Variable Search Replace step for each: `&` to `%26`, `=` to `%3D`, `%` to `%25` (do `%` first)

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
