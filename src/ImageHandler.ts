import { App } from "obsidian";

/** All image handling: clipboard paste, drag-drop, mobile file picker. */
export class ImageHandler {
  constructor(private app: App, private captureFilePath: string) {}

  /** Generate a timestamped filename for a captured image. */
  generateFilename(mimeType: string): string {
    // Implemented in section-03
    return "";
  }

  /** Save an ArrayBuffer as an image file in the vault attachment folder.
   *  Returns the Obsidian embed string `![[filename.ext]]`. */
  async saveImage(buffer: ArrayBuffer, mimeType: string): Promise<string> {
    // Implemented in section-03
    return "";
  }
}
