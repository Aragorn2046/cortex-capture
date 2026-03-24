import { describe, it, expect } from "vitest";
import { parseItems, buildPrependLine, toggleLine, formatTimestamp } from "./CortexFile";

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
