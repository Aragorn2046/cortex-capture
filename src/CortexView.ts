import { ItemView, WorkspaceLeaf, TFile, Platform } from "obsidian";
import { parseItems, buildPrependLine, toggleLine, formatTimestamp } from "./CortexFile";
import type { CortexItem } from "./CortexFile";
import { ImageHandler } from "./ImageHandler";
import type { CortexSettings } from "./settings";

export const CORTEX_VIEW_TYPE = "cortex-view";

export class CortexView extends ItemView {
  private imageHandler!: ImageHandler;

  // DOM refs
  private textarea!: HTMLTextAreaElement;
  private imagePreviewEl!: HTMLDivElement;
  private listEl!: HTMLDivElement;

  // State
  private ignoreNextModify = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private getSettings: () => CortexSettings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return CORTEX_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Cortex";
  }

  getIcon(): string {
    return "brain";
  }

  async onOpen(): Promise<void> {
    const settings = this.getSettings();
    this.imageHandler = new ImageHandler(this.app, settings.captureFile);
    this.buildUI();
    await this.refreshChecklist();
    this.attachFileWatcher();
    this.textarea.focus();
  }

  async onClose(): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.contentEl.empty();
  }

  // --- UI Construction ---

  private buildUI(): void {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: "cortex-container" });
    if (Platform.isMobile) container.addClass("cortex-mobile");

    this.buildInputArea(container);
    this.listEl = container.createDiv({ cls: "cortex-list", attr: { role: "list" } });
  }

  private buildInputArea(container: HTMLElement): void {
    const inputArea = container.createDiv({ cls: "cortex-input-area" });

    this.textarea = inputArea.createEl("textarea", {
      cls: "cortex-textarea",
      attr: { placeholder: "Capture an idea...", rows: "2" },
    });

    // Keyboard: Enter to submit, Escape to clear
    this.registerDomEvent(this.textarea, "keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.submitItem();
      } else if (e.key === "Escape") {
        this.textarea.value = "";
        this.imageHandler.clearPendingImage();
      }
    });

    // Image preview area
    this.imagePreviewEl = inputArea.createDiv({ cls: "cortex-image-preview" });
    this.imagePreviewEl.style.display = "none";

    // Button row
    const btnRow = inputArea.createDiv({ cls: "cortex-btn-row" });

    const imageBtn = btnRow.createEl("button", {
      cls: "cortex-image-btn",
      text: Platform.isMobile ? "Add Image" : "\u{1F4F7}",
    });
    this.registerDomEvent(imageBtn, "click", () => {
      this.imageHandler.openFilePicker();
    });

    const submitBtn = btnRow.createEl("button", {
      cls: "cortex-submit-btn",
      text: "Capture",
    });
    this.registerDomEvent(submitBtn, "click", () => {
      this.submitItem();
    });

    // Register image handler listeners
    this.imageHandler.registerListeners(
      this.textarea,
      inputArea,
      this.imagePreviewEl,
      (el: HTMLElement, event: string, handler: (e: Event) => void) =>
        this.registerDomEvent(el, event, handler)
    );
  }

  // --- Submit ---

  private async submitItem(): Promise<void> {
    const settings = this.getSettings();
    const text = this.textarea.value.replace(/[\n\r]/g, " ").trim();
    const embed = this.imageHandler.getEmbed();

    if (!text && !embed) return;

    const timestamp = settings.showTimestamps
      ? formatTimestamp(new Date(), settings.timestampFormat)
      : "";

    const newLine = buildPrependLine(text, embed, settings.showTimestamps, timestamp);

    this.ignoreNextModify = true;

    const file = this.app.vault.getAbstractFileByPath(settings.captureFile);
    if (file instanceof TFile) {
      await this.app.vault.process(file, (content) => {
        return content ? newLine + "\n" + content : newLine;
      });
    } else {
      await this.app.vault.create(settings.captureFile, newLine);
    }

    this.textarea.value = "";
    this.imageHandler.clearPendingImage();
    await this.refreshChecklist();
    this.textarea.focus();
  }

  // --- Checklist Rendering ---

  private async refreshChecklist(): Promise<void> {
    const settings = this.getSettings();
    const file = this.app.vault.getAbstractFileByPath(settings.captureFile);
    let items: CortexItem[] = [];

    if (file instanceof TFile) {
      const content = await this.app.vault.read(file);
      items = parseItems(content);
    }

    this.listEl.empty();
    for (const item of items) {
      this.listEl.appendChild(this.renderItem(item));
    }
  }

  private renderItem(item: CortexItem): HTMLElement {
    const div = createDiv({
      cls: `cortex-item${item.checked ? " cortex-item--checked" : ""}`,
      attr: { role: "listitem" },
    });

    const checkbox = div.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
    checkbox.checked = item.checked;
    this.registerDomEvent(checkbox, "change", () => {
      this.toggleItem(item.line);
    });

    const textSpan = div.createSpan({ cls: "cortex-item-text" });
    this.renderInlineMarkdown(item.text, textSpan);

    if (item.images.length > 0) {
      const imgContainer = div.createDiv({ cls: "cortex-item-images" });
      for (const filename of item.images) {
        const thumb = this.renderImageThumbnail(filename);
        if (thumb) imgContainer.appendChild(thumb);
      }
    }

    return div;
  }

  /** Render simple inline markdown using safe DOM methods (no innerHTML). */
  private renderInlineMarkdown(text: string, container: HTMLElement): void {
    // Strip image embeds (rendered as thumbnails separately)
    const clean = text.replace(/!\[\[[^\]]+\]\]/g, "").trim();
    // For safety, render as plain text. Bold/italic/links are a nice-to-have
    // but using innerHTML with user content is an XSS risk.
    container.textContent = clean;
  }

  private renderImageThumbnail(filename: string): HTMLElement | null {
    const settings = this.getSettings();

    let file = this.app.vault.getAbstractFileByPath(filename);

    if (!(file instanceof TFile)) {
      const resolved = this.app.metadataCache.getFirstLinkpathDest(filename, settings.captureFile);
      if (resolved instanceof TFile) file = resolved;
    }

    if (!(file instanceof TFile)) return null;

    try {
      const img = createEl("img", { cls: "cortex-thumb" });
      img.src = this.app.vault.getResourcePath(file);
      return img;
    } catch {
      return null;
    }
  }

  // --- Toggle ---

  private async toggleItem(lineIndex: number): Promise<void> {
    const settings = this.getSettings();
    this.ignoreNextModify = true;

    const file = this.app.vault.getAbstractFileByPath(settings.captureFile);
    if (file instanceof TFile) {
      await this.app.vault.process(file, (content) => {
        return toggleLine(content, lineIndex);
      });
    }

    await this.refreshChecklist();
  }

  // --- File Watcher ---

  private attachFileWatcher(): void {
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) this.onFileModified(file);
      })
    );
  }

  private onFileModified(file: TFile): void {
    const settings = this.getSettings();
    if (file.path !== settings.captureFile) return;

    if (this.ignoreNextModify) {
      this.ignoreNextModify = false;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.refreshChecklist();
    }, 300);
  }
}
