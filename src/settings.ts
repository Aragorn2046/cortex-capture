import { App, PluginSettingTab, Setting } from "obsidian";
import type CortexPlugin from "../main";

export interface CortexSettings {
  captureFile: string;
  prependNew: boolean;
  showTimestamps: boolean;
  timestampFormat: string;
}

export const DEFAULT_SETTINGS: CortexSettings = {
  captureFile: "_Cortex.md",
  prependNew: true,
  showTimestamps: false,
  timestampFormat: "YYYY-MM-DD HH:mm",
};

export class CortexSettingTab extends PluginSettingTab {
  plugin: CortexPlugin;

  constructor(app: App, plugin: CortexPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Cortex 2.0 Settings" });

    new Setting(containerEl)
      .setName("Capture file")
      .setDesc("Path to the markdown file used for captures (must end in .md)")
      .addText((text) =>
        text
          .setPlaceholder("_Cortex.md")
          .setValue(this.plugin.settings.captureFile)
          .onChange(async (value) => {
            if (value.endsWith(".md")) {
              this.plugin.settings.captureFile = value;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Prepend new items")
      .setDesc("Add new captures to the top of the file (newest first)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.prependNew)
          .onChange(async (value) => {
            this.plugin.settings.prependNew = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show timestamps")
      .setDesc("Add a timestamp to each captured item")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTimestamps)
          .onChange(async (value) => {
            this.plugin.settings.showTimestamps = value;
            await this.plugin.saveSettings();
            this.display(); // Re-render to show/hide format field
          })
      );

    if (this.plugin.settings.showTimestamps) {
      new Setting(containerEl)
        .setName("Timestamp format")
        .setDesc("Format string (e.g. YYYY-MM-DD HH:mm)")
        .addText((text) =>
          text
            .setPlaceholder("YYYY-MM-DD HH:mm")
            .setValue(this.plugin.settings.timestampFormat)
            .onChange(async (value) => {
              this.plugin.settings.timestampFormat = value;
              await this.plugin.saveSettings();
            })
        );
    }
  }
}
