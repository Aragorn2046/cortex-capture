import { describe, it, expect } from "vitest";
import { parseItems, prependItem, toggleItem } from "./CortexFile";

describe("CortexFile", () => {
  it.todo("parses unchecked item");
  it.todo("parses checked item [x]");
  it.todo("parses checked item [X]");
  it.todo("parses item with image embed");
  it.todo("parses item with multiple images");
  it.todo("parses indented item");
  it.todo("preserves non-checkbox lines");
  it.todo("handles empty text after checkbox");
  it.todo("handles empty file");
  it.todo("prepend to empty file");
  it.todo("prepend to file with existing items");
  it.todo("prepend with image embed");
  it.todo("prepend with timestamp enabled");
  it.todo("prepend strips newlines from input");
  it.todo("prepend with empty text but image");
  it.todo("toggle unchecked item becomes [x]");
  it.todo("toggle checked item becomes [ ]");
  it.todo("toggle by line index");
  it.todo("toggle preserves text and image embeds");
  it.todo("toggle at invalid line index does not crash");
});
