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
