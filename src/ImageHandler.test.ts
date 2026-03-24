import { describe, it, expect } from "vitest";
import { generateFilename, mimeToExt, makeEmbedString } from "./ImageHandler";

describe("generateFilename", () => {
  it("produces pattern capture-YYYYMMDDHHmmss.ext", () => {
    const date = new Date(2026, 2, 24, 14, 30, 0);
    const result = generateFilename(date, "png");
    expect(result).toMatch(/^capture-\d{14}\.png$/);
  });

  it("encodes date correctly", () => {
    const date = new Date(2026, 2, 24, 14, 30, 45);
    expect(generateFilename(date, "png")).toBe("capture-20260324143045.png");
  });

  it("works with jpg extension", () => {
    const date = new Date(2026, 2, 24, 14, 30, 0);
    expect(generateFilename(date, "jpg")).toMatch(/\.jpg$/);
  });
});

describe("mimeToExt", () => {
  it("maps image/png to png", () => {
    expect(mimeToExt("image/png")).toBe("png");
  });

  it("maps image/jpeg to jpg", () => {
    expect(mimeToExt("image/jpeg")).toBe("jpg");
  });

  it("maps image/gif to gif", () => {
    expect(mimeToExt("image/gif")).toBe("gif");
  });

  it("maps image/webp to webp", () => {
    expect(mimeToExt("image/webp")).toBe("webp");
  });

  it("maps image/heic to heic", () => {
    expect(mimeToExt("image/heic")).toBe("heic");
  });

  it("returns png as fallback for unknown MIME", () => {
    expect(mimeToExt("application/octet-stream")).toBe("png");
  });
});

describe("makeEmbedString", () => {
  it("wraps filename in Obsidian embed syntax", () => {
    expect(makeEmbedString("capture-20260324143000.png")).toBe(
      "![[capture-20260324143000.png]]"
    );
  });

  it("handles filename with spaces", () => {
    expect(makeEmbedString("my image.png")).toBe("![[my image.png]]");
  });
});
