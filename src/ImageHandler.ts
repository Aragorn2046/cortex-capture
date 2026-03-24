import { App, Notice } from "obsidian";

const MIME_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Generates a filename like `capture-20260324143000.png` */
export function generateFilename(date: Date, ext: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp =
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds());
  return `capture-${stamp}.${ext}`;
}

/** Maps a MIME type string to a file extension. Returns 'png' as fallback. */
export function mimeToExt(mimeType: string): string {
  return MIME_MAP[mimeType] ?? "png";
}

/** Returns the Obsidian embed string for a filename: `![[filename]]` */
export function makeEmbedString(filename: string): string {
  return `![[${filename}]]`;
}

/** All image handling: clipboard paste, drag-drop, mobile file picker. */
export class ImageHandler {
  private pendingEmbed = "";
  private previewObjectUrl = "";
  private previewEl: HTMLDivElement | null = null;
  private fileInput: HTMLInputElement | null = null;

  constructor(
    private app: App,
    private captureFilePath: string
  ) {}

  /** Get the current pending embed string. Empty if no image attached. */
  getEmbed(): string {
    return this.pendingEmbed;
  }

  /** Clear the pending image and preview. */
  clearPendingImage(): void {
    this.pendingEmbed = "";
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = "";
    }
    if (this.previewEl) {
      this.previewEl.empty();
      this.previewEl.style.display = "none";
    }
  }

  /** Set up all event listeners. Call from CortexView.onOpen(). */
  registerListeners(
    textarea: HTMLTextAreaElement,
    inputArea: HTMLElement,
    previewEl: HTMLDivElement,
    registerDomEvent: (el: HTMLElement, event: string, handler: (e: Event) => void) => void
  ): void {
    this.previewEl = previewEl;

    // Desktop: clipboard paste on textarea
    registerDomEvent(textarea, "paste", (e: Event) => {
      const event = e as ClipboardEvent;
      const files = event.clipboardData?.files;
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          event.preventDefault();
          this.handleFile(files[i]);
          return;
        }
      }
    });

    // Desktop: drag-and-drop
    registerDomEvent(inputArea, "dragover", (e: Event) => {
      e.preventDefault();
      inputArea.addClass("cortex-drag-over");
    });

    registerDomEvent(inputArea, "dragleave", () => {
      inputArea.removeClass("cortex-drag-over");
    });

    registerDomEvent(inputArea, "drop", (e: Event) => {
      e.preventDefault();
      inputArea.removeClass("cortex-drag-over");
      const event = e as DragEvent;
      const files = event.dataTransfer?.files;
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          this.handleFile(files[i]);
          return;
        }
      }
    });

    // Mobile: hidden file input
    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = "image/*";
    this.fileInput.style.display = "none";
    inputArea.appendChild(this.fileInput);

    registerDomEvent(this.fileInput, "change", () => {
      const file = this.fileInput?.files?.[0];
      if (file) this.handleFile(file);
    });
  }

  /** Trigger the mobile file picker. */
  openFilePicker(): void {
    this.fileInput?.click();
  }

  /** Core save logic shared by all input paths. */
  private async handleFile(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) return;

    try {
      const ext = mimeToExt(file.type);
      const filename = generateFilename(new Date(), ext);
      const attachmentPath =
        (this.app.fileManager as any).getAvailablePathForAttachment(
          filename,
          this.captureFilePath
        );
      const buffer = await file.arrayBuffer();
      await this.app.vault.createBinary(attachmentPath, buffer);

      this.pendingEmbed = makeEmbedString(filename);
      this.showPreview(file);
    } catch (err) {
      new Notice(`Failed to save image: ${err}`);
    }
  }

  /** Show thumbnail preview of the attached image. */
  private showPreview(file: File): void {
    if (!this.previewEl) return;

    this.previewEl.empty();
    this.previewObjectUrl = URL.createObjectURL(file);

    const img = this.previewEl.createEl("img", {
      cls: "cortex-preview-img",
    });
    img.src = this.previewObjectUrl;

    const removeBtn = this.previewEl.createEl("button", {
      cls: "cortex-preview-remove",
      text: "×",
    });
    removeBtn.addEventListener("click", () => this.clearPendingImage());

    this.previewEl.style.display = "flex";
  }
}
