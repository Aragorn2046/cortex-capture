import { Plugin } from "obsidian";
import { CortexSettings, DEFAULT_SETTINGS } from "./src/settings";

export default class CortexPlugin extends Plugin {
  settings: CortexSettings;

  async onload(): Promise<void> {
    // Implemented in section-05
  }

  async onunload(): Promise<void> {
    // Implemented in section-05
  }
}
