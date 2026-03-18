## Why

The current NotebookLM folder panel is injected at the top of the notebook cards grid. This forces users to scroll extensively to switch between folders and the notebook list, leading to a poor navigation experience. Moving the panel to the left as a persistent sidebar enables parallel navigation and increases management efficiency. Additionally, integrating Gemini-like action buttons (Export, Sync, Cloud) provides advanced management capabilities directly in the UI.

## What Changes

- Redesign the layout of `.welcome-page-container` to use a two-column sidebar structure (Grid/Flex).
- Reposition `NotebookLMFolderManager` injection target from the top of the grid to the left sidebar slot.
- Update the Folder Header UI to include functional buttons: Account Isolation, Import/Export, Upload/Sync from Cloud, and Add Folder.
- Refine CSS for fixed sidebar width, sticky positioning, and responsive fallback for smaller screens.

## Capabilities

### New Capabilities
- `notebooklm-sidebar-layout`: Implementation of the sidebar shell, handling positioning and responsive breakpoints.

### Modified Capabilities
- `notebooklm-adapter`: Adjust injection logic and update header UI to support advanced action buttons.

## Impact

- `src/pages/content/folder/notebooklm.ts`: Modify `injectFolderUI` and `render` methods for sidebar injection and header button implementation.
- `public/contentStyle.css` / Inline styles: New CSS rules for the grid-based layout and sidebar appearance.
- Responsive Behavior: Sidebar reverts to a top-panel layout on screens narrower than 1024px.
