import { describe, it, expect } from "vitest";
import { parseItems, buildPrependLine, toggleLine, editLine, deleteLine, formatTimestamp } from "./CortexFile";

describe("parseItems", () => {
  it("parses unchecked item", () => {
    const items = parseItems("- [ ] hello");
    expect(items).toEqual([
      { checked: false, text: "hello", images: [], line: 0, raw: "- [ ] hello" },
    ]);
  });

  it("parses checked item (lowercase x)", () => {
    const items = parseItems("- [x] done");
    expect(items).toEqual([
      { checked: true, text: "done", images: [], line: 0, raw: "- [x] done" },
    ]);
  });

  it("parses checked item (uppercase X)", () => {
    const items = parseItems("- [X] done");
    expect(items).toEqual([
      { checked: true, text: "done", images: [], line: 0, raw: "- [X] done" },
    ]);
  });

  it("parses item with single image embed", () => {
    const items = parseItems("- [ ] idea ![[img.png]]");
    expect(items[0].images).toEqual(["img.png"]);
  });

  it("parses item with multiple image embeds", () => {
    const items = parseItems("- [ ] text ![[a.png]] ![[b.jpg]]");
    expect(items[0].images).toEqual(["a.png", "b.jpg"]);
  });

  it("parses indented item", () => {
    const items = parseItems("  - [ ] indented");
    expect(items).toHaveLength(1);
    expect(items[0].checked).toBe(false);
    expect(items[0].text).toBe("indented");
  });

  it("skips non-checkbox lines but preserves line indices", () => {
    const items = parseItems("# My Header\n\n- [ ] real item");
    expect(items).toHaveLength(1);
    expect(items[0].line).toBe(2);
    expect(items[0].text).toBe("real item");
  });

  it("handles empty text after checkbox marker", () => {
    const items = parseItems("- [ ] ");
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("");
  });

  it("returns empty array for empty file", () => {
    expect(parseItems("")).toEqual([]);
  });

  it("returns empty array for file with only non-checkbox content", () => {
    expect(parseItems("# Header\nsome text")).toEqual([]);
  });
});

describe("buildPrependLine", () => {
  it("builds basic item with no image or timestamp", () => {
    expect(buildPrependLine("hello", "", false, "")).toBe("- [ ] hello");
  });

  it("builds item with image embed", () => {
    expect(buildPrependLine("idea", "![[capture-123.png]]", false, "")).toBe(
      "- [ ] idea ![[capture-123.png]]"
    );
  });

  it("builds item with timestamp", () => {
    expect(buildPrependLine("hello", "", true, "2026-03-24 14:30")).toBe(
      "- [ ] [2026-03-24 14:30] hello"
    );
  });

  it("strips newlines from input text", () => {
    expect(buildPrependLine("line one\nline two", "", false, "")).toBe(
      "- [ ] line one line two"
    );
  });

  it("builds item with empty text but image", () => {
    expect(buildPrependLine("", "![[img.png]]", false, "")).toBe(
      "- [ ] ![[img.png]]"
    );
  });
});

describe("toggleLine", () => {
  it("toggles unchecked to checked", () => {
    const result = toggleLine("- [ ] first\n- [ ] second", 0);
    expect(result).toBe("- [x] first\n- [ ] second");
  });

  it("toggles checked to unchecked", () => {
    const result = toggleLine("- [x] done\n- [ ] other", 0);
    expect(result).toBe("- [ ] done\n- [ ] other");
  });

  it("toggles correct line by index", () => {
    const result = toggleLine("- [ ] first\n- [ ] second", 1);
    expect(result).toBe("- [ ] first\n- [x] second");
  });

  it("preserves text and image embeds after toggle", () => {
    const result = toggleLine("- [ ] idea ![[img.png]]", 0);
    expect(result).toBe("- [x] idea ![[img.png]]");
  });

  it("returns content unchanged for invalid line index", () => {
    const content = "- [ ] only line";
    expect(toggleLine(content, 99)).toBe(content);
  });

  it("returns content unchanged for non-checkbox line", () => {
    const content = "# Header\n- [ ] item";
    expect(toggleLine(content, 0)).toBe(content);
  });
});

describe("editLine", () => {
  it("replaces text of an unchecked item", () => {
    const result = editLine("- [ ] old text", 0, "new text");
    expect(result).toBe("- [ ] new text");
  });

  it("replaces text of a checked item", () => {
    const result = editLine("- [x] old text", 0, "new text");
    expect(result).toBe("- [x] new text");
  });

  it("preserves image embeds when editing text", () => {
    const result = editLine("- [ ] old text ![[img.png]]", 0, "new text");
    expect(result).toBe("- [ ] new text ![[img.png]]");
  });

  it("preserves multiple image embeds", () => {
    const result = editLine("- [ ] old ![[a.png]] ![[b.jpg]]", 0, "new");
    expect(result).toBe("- [ ] new ![[a.png]] ![[b.jpg]]");
  });

  it("edits correct line by index", () => {
    const result = editLine("- [ ] first\n- [ ] second\n- [ ] third", 1, "edited");
    expect(result).toBe("- [ ] first\n- [ ] edited\n- [ ] third");
  });

  it("strips newlines from new text", () => {
    const result = editLine("- [ ] old", 0, "line one\nline two");
    expect(result).toBe("- [ ] line one line two");
  });

  it("preserves indentation", () => {
    const result = editLine("  - [ ] indented", 0, "still indented");
    expect(result).toBe("  - [ ] still indented");
  });

  it("returns content unchanged for invalid line index", () => {
    const content = "- [ ] only line";
    expect(editLine(content, 99, "new")).toBe(content);
  });

  it("returns content unchanged for non-checkbox line", () => {
    const content = "# Header\n- [ ] item";
    expect(editLine(content, 0, "new")).toBe(content);
  });
});

describe("deleteLine", () => {
  it("removes an unchecked item", () => {
    const result = deleteLine("- [ ] first\n- [ ] second", 0);
    expect(result).toBe("- [ ] second");
  });

  it("removes a checked item", () => {
    const result = deleteLine("- [x] done\n- [ ] pending", 0);
    expect(result).toBe("- [ ] pending");
  });

  it("removes correct line by index", () => {
    const result = deleteLine("- [ ] first\n- [ ] second\n- [ ] third", 1);
    expect(result).toBe("- [ ] first\n- [ ] third");
  });

  it("returns content unchanged for invalid line index", () => {
    const content = "- [ ] only";
    expect(deleteLine(content, 99)).toBe(content);
  });

  it("returns content unchanged for non-checkbox line", () => {
    const content = "# Header\n- [ ] item";
    expect(deleteLine(content, 0)).toBe(content);
  });

  it("handles removing the only line", () => {
    const result = deleteLine("- [ ] solo", 0);
    expect(result).toBe("");
  });
});

describe("formatTimestamp", () => {
  it("formats with default YYYY-MM-DD HH:mm pattern", () => {
    const date = new Date(2026, 2, 24, 14, 30);
    expect(formatTimestamp(date, "YYYY-MM-DD HH:mm")).toBe("2026-03-24 14:30");
  });

  it("formats with DD/MM/YYYY pattern", () => {
    const date = new Date(2026, 2, 24, 14, 30);
    expect(formatTimestamp(date, "DD/MM/YYYY")).toBe("24/03/2026");
  });

  it("zero-pads single-digit values", () => {
    const date = new Date(2026, 0, 5, 3, 7, 9);
    expect(formatTimestamp(date, "YYYY-MM-DD HH:mm:ss")).toBe("2026-01-05 03:07:09");
  });
});
