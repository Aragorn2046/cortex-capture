# Cortex 2.0 — Deep Plan Interview

## Context

Interview informed by research findings on Obsidian Plugin API, mobile share intent limitations, image handling APIs, and cross-platform patterns. Several design decisions were driven by platform constraints discovered during research.

---

## Q1: Mobile Image Capture Approach

**Question**: Research shows clipboard image paste does NOT work on Obsidian Mobile (OS restriction). On mobile, we'd need a file picker button (camera/gallery). On desktop, paste works fine. Is this acceptable?

**Answer**: Mobile image capture is CRITICAL. User takes screenshots on phone constantly and wants them in the vault with zero friction. File picker alone isn't enough — the share-from-gallery path (Share > Obsidian > lands in Cortex) is the priority.

**Key quote**: "I take screenshots of my screen on my phone all the time. I want to be able to make them go into the Obsidian vault as easily as possible with as little friction as possible."

---

## Q2: Android Share Intent Architecture

**Question**: Obsidian plugins can't intercept raw Android share intents. Two options: Tasker automation (one-time setup, full control) or Obsidian's native share handler (less control, no extra app).

**Answer**: Tasker automation (one-time setup). User is willing to do a one-time Tasker configuration for the cleanest daily-use experience. The flow: Share > Tasker > `obsidian://cortex?image=...` URI > plugin handles it.

---

## Q3: View Position

**Question**: Where should the Cortex view open?

**Answer**: Opens directly to the Cortex plugin/checklist view. "It needs to open where the stuff goes." No preference for sidebar vs tab — just needs to show the capture interface immediately.

**Decision**: Open as a new tab (full width on mobile, tabbed on desktop). Most natural for a standalone capture tool and goes full-screen on mobile automatically.

---

## Q4: Image Context

**Question**: When dumping a screenshot, do you usually add text with it?

**Answer**: Usually adds a note — screenshot + a line of text explaining why it was captured. Both go in as one Cortex item.

**Implication**: The share flow should support both image + text in a single capture. After sharing an image via Tasker/URI, the Cortex view should open with the image attached and cursor ready for typing the context note.

---

## Summary of Design Decisions from Interview

1. **Mobile image capture via Android share intent** — Tasker automation routes shares to `obsidian://cortex` URI handler
2. **Share flow**: Share screenshot > Tasker intercepts > sends `obsidian://cortex?image=<path>` > plugin opens Cortex view with image pre-attached > user types context note > submit
3. **In-app capture**: File picker button for when already in Cortex (mobile) + clipboard paste (desktop only)
4. **View opens as tab** — full width, full screen on mobile
5. **Images usually have context text** — the UI should make it natural to add text alongside an image
6. **Zero friction is the north star** — every extra tap or step is a failure
