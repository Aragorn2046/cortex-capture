import { Plugin, WorkspaceLeaf } from "obsidian";
import { CortexView, CORTEX_VIEW_TYPE } from "./src/CortexView";
import { CortexSettings, DEFAULT_SETTINGS, CortexSettingTab } from "./src/settings";

export default class CortexPlugin extends Plugin {
  settings!: CortexSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      CORTEX_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new CortexView(leaf, () => this.settings)
    );

    this.addRibbonIcon("brain", "Open Cortex", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-cortex-view",
      name: "Open capture view",
      callback: () => this.activateView(),
    });

    this.registerObsidianProtocolHandler("cortex", async (params) => {
      await this.activateView();

      const leaves = this.app.workspace.getLeavesOfType(CORTEX_VIEW_TYPE);
      if (leaves.length === 0) return;
      const view = leaves[0].view as CortexView;

      if (params.text) {
        view.setInputText(decodeURIComponent(params.text));
      }

      if (params.image) {
        await view.attachImageFromPath(decodeURIComponent(params.image));
      }

      if (params.submit === "true") {
        await view.submitItem();
      }
    });

    this.addSettingTab(new CortexSettingTab(this.app, this));

    // Ensure capture file exists
    const filePath = this.settings.captureFile;
    if (!(await this.app.vault.adapter.exists(filePath))) {
      await this.app.vault.create(filePath, "");
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(CORTEX_VIEW_TYPE);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    const existing = workspace.getLeavesOfType(CORTEX_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: CORTEX_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
