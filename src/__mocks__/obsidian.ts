// Mock obsidian module for unit testing.
// Only stubs what's needed — tests should not exercise Obsidian API.

export class App {}
export class Notice {
  constructor(public message: string) {}
}
export class Plugin {}
export class ItemView {
  app: any;
  containerEl: any = { children: [] };
  getViewType() { return ""; }
  getDisplayText() { return ""; }
}
export class TFile {}
export class PluginSettingTab {}
export class Setting {}
