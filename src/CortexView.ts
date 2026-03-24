import { ItemView, WorkspaceLeaf } from "obsidian";

export const CORTEX_VIEW_TYPE = "cortex-view";

export class CortexView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return CORTEX_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Cortex";
  }

  async onOpen(): Promise<void> {
    // Implemented in section-04
  }

  async onClose(): Promise<void> {
    // Implemented in section-04
  }
}
