# Tasks: NotebookLM Folder Sidebar (Architect Refined)

## Phase 1: Sidebar Layout & Injection Architecture

- [x] **Define Container Styles**: Implement `gv-sidebar-layout` and `gv-main-content` grid definitions in `contentStyle.css`. Ensure all classes follow the `gv-` namespace.
- [x] **Target Switching Logic**: Modify `injectFolderUI` in `notebooklm.ts` to target `.welcome-page-container`. 
- [x] **Injection Safety**: Implement a presence check for `.welcome-page-container` to avoid initialization errors when NotebookLM DOM is not ready.
- [x] **Grid Layout Implementation**: Apply `display: grid` with `grid-template-columns: 300px 1fr` to the welcome container and manage column assignment.
- [x] **Responsive Breakpoints**: Add CSS media queries for `< 1024px` to reset `display: grid` to `display: block`, ensuring top-panel fallback.

## Phase 2: Folder Header Refactor & Advanced Actions

- [x] **Refactor Header Template**: Update HTML template in `notebooklm.ts` to follow the Gemini structure: Title Container + Action Button Group.
- [x] **Embed Inline SVG Icons**: Implement the SVG paths for "Account Isolation", "Import/Export", and "Cloud Sync" directly in the template (avoiding Material Icon font dependencies).
- [x] **Action Button Styling**: Implement `.gv-folder-action-btn` style in CSS with proper size (20-24px), hover transitions, and Material-like look.
- [x] **Event Hooking & Tooltips**: Attach standard tooltips (title) and click listeners to the new actions. Map click events to existing services (e.g., `GoogleDriveSyncService` placeholders).

## Phase 3: Cleanup & Interface Robustness

- [x] **Cleanup Legacy Selectors**: Remove obsolete top-injection selectors and margin adjustments from the previous "refactor-folder-manager-for-multi-site" implementation.
- [x] **Z-Index & Overflow Audit**: Ensure sidebar does not clip tooltips or folder context menus. Verify that the folder list itself is vertically scrollable (`overflow-y: auto`) if it exceeds viewport height.
- [x] **Drag & Drop Alignment**: Verify that dragging notebooks into the sidebar sidebar remains functional after the grid layout change.

## Phase 4: Verification (Architect's Checklist)

- [x] **Layout Stability**: Verify zero interference with existing NotebookLM "Create" button positioning and general responsiveness.
- [x] **Sticky Verification**: Ensure the sidebar remains sticky when the laptop grid is extensively long.
- [x] **Build Validation**: Run `bun run build:chrome` and check for errors.

## Phase 5: Action Button Functional Logic

### Account Isolation Integration
- [x] **Account Detection**: Update `detectAccountContextFromDocument` in `AccountIsolationService.ts` to support NotebookLM's email/account selectors.
- [x] **Scoped Storage**: Update `NotebookLMFolderManager.init` to handle account-scoped storage keys if isolation is active.
- [x] **Isolation Setting**: Implement toggle or state-check for the "Account Isolation" button in the header.

### Import/Export & Sync Features
- [x] **Import/Export Menu**: Implement `showImportExportMenu` dropdown with `Import` and `Export` actions.
- [x] **Local Data Transfer**: Integrate `FolderImportExportService` for file-based backup/restore.
- [x] **Cloud Sync Implementation**: Implement `handleCloudUpload` and `handleCloudSync` using `browser.runtime.sendMessage`.
- [x] **Data Merge Engine**: Implement `mergeFolderData` to safely combine local and cloud datasets.
- [x] **Dynamic Tooltips**: Add sync state monitoring to show "Last synced X minutes ago" in button tooltips.

## Phase 6: UX Polish & Bug Fixes

### Sidebar Toggle Feature
- [x] **Toggle Integration**: Add a show/hide button to the NotebookLM UI.
- [x] **State Persistence**: Store the sidebar visibility state in `chrome.storage.local`.
- [x] **Reactive Layout**: Adjust CSS grid when sidebar is hidden/shown.
- [x] **Floating Toggle**: Add a floating toggle button for desktop view when collapsed.

### Layout Consistency & Critical Fixes
- [x] **Indentation Fix**: Re-align notebooks and subfolders within the folder tree to use the same left margin/padding.
- [x] **Icon Consistency**: Sync notebook item icons in sidebar with the actual card icons/emojis.
- [x] **Multi-user Support**: Preserve `authuser` parameter in sidebar links to fix multi-login session loss.
- [x] **Container Stacking Fix**: Resolve layout overlap between sidebar and original page content using explicit grid columns.

## Phase 7: Native Menu Integration
- [x] **Mutation Observer for Menus**: Monitor `.cdk-overlay-pane` for the appearance of notebook action menus.
- [x] **"Move to Folder" Button Injection**: Dynamically inject custom menu items into the Material menu list.
- [x] **Folder Picker UI**: Implement a scrollable modal with folder selection functionality.
- [x] **Unified State Update**: Ensure moving a notebook via native menu correctly updates the sidebar data and UI.

## Phase 8: Advanced Drag-and-Drop stabilization
- [x] **Bubbling Prevention**: Implement `e.stopPropagation()` in all drag/drop event listeners to support nested folder trees.
- [x] **Flicker-Free Highlighting**: Implement `dragCounter` in both Gemini and NotebookLM to stabilize folder highlights.
- [x] **Compact Drag Image**: Implement `setSmallDragImage` to provide a clean, non-obstructive drag preview.
- [x] **Robust UI Highlighting**: Standardize on `outline` instead of `border` for drop-zone visual feedback to avoid layout shifting.

## Phase 9: Stability & Hierarchy Improvements
- [x] **Event Delegation**: Move notebook card tracking to container-level delegated listeners for improved reliability.
- [x] **Account Retry Logic**: Implement `resolveAccountContext` with retries in `refreshUI` to handle slow account session loading.
- [x] **Tree-structured Picker**: Refactor folder picker to use recursive rendering with monospace tree lines.
- [x] **Enhanced Field Extraction**: Add `jslog` parsing to notebook ID extraction logic.
