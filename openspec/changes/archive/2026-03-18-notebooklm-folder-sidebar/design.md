## Context

NotebookLM currently uses a vertical flow layout where folders are placed above the project grid. This requires frequent scrolling and lacks a consistent navigation hub.

## Goals / Non-Goals

**Goals:**
- Convert the folder panel into a sidebar fixed to the left side.
- Enable side-by-side navigation between folders and notebooks.
- Implement Gemini-style action buttons in the folder header.
- Ensure responsive behavior (sidebar on desktop, top-panel on mobile).

**Non-Goals:**
- Changing underlying folder data structures or CRUD logic (except for scoping per account).
- Altering the internal layout of NotebookLM's notebook cards.

## Sidebar Header Actions: Core Logic

### Account Isolation Detection
The sidebar header MUST detect the current user by observing the NotebookLM navigation bar or account switcher elements. 
- **Storage Strategy**: Derived from `StorageKeys.FOLDER_DATA_NOTEBOOKLM`. If isolation is active, it becomes `FOLDER_DATA_NOTEBOOKLM:acct:{hash}`.
- **Service Dependency**: `AccountIsolationService`.

### Import/Export & Sync Workflow
- **Import/Export**: Re-uses the existing `DataBackupService` (local) and `FolderImportExportService`.
- **Cloud Sync**: Acts as a client for the extension's background `GoogleDriveSyncService`. It provides a JSON payload containing Notebook references to the sync service and merges incoming datasets.
- **Merge Strategy**: Folders and notebooks are merged by their UUIDs. If a local UUID matches a remote one, the remote version MUST be prioritized if it has a newer `updatedAt` timestamp.

### Sidebar Toggle & Indentation
- **Toggle Strategy**: Introduce a `gv-sidebar-collapsed` class on the parent container. This class will change the Grid layout from `320px 1fr` to `0px 1fr` and hide the sidebar content.
- **Toggle Button**: A small floating or header-integrated button with a `chevron` or `hamburger` icon.
- **Indentation fix**: Subfolders and notebooks MUST share the same `--folder-level * indent_size` calculation in CSS to ensure alignment.

## Decisions

1. **DOM Injection**:
   - Change target to `.welcome-page-container`.
   - Prepend the folder container as the first child of the welcome container.

2. **Folder Header UI**:
   - Refactor the header to include an action button bar.
   - Map icons: `person` (Isolation), `folder_managed` (Transfer), `cloud_upload`/`cloud_download` (Sync), `add` (Create).

3. **CSS Grid Layout**:
   - Apply `display: grid` to `.welcome-page-container`.
   - Columns: `300px 1fr` for desktop.
   - Sidebar: `position: sticky; top: 0; height: 100vh;` or container-relative stickiness.

4. **Responsive Strategy**:
   - Use `@media (max-width: 1024px)` to switch to `display: block` and reset sidebar width.

## Risks / Trade-offs

- **Layout Interference**: Adjusting the main container's layout might conflict with NotebookLM's Angular-based scrolling or lazy loading.
- **Horizontal Space**: Sidebar reduces the grid area, potentially reducing the number of cards per row on smaller desktop views.
