## Purpose
This specification covers the implementation of folder-based organization for `notebooklm.google.com`.
## Requirements
### Requirement: Sidebar Layout & Toggle Mechanism
The system SHALL provide a permanent navigation hub for folders while allowing users to hide it to maximize screen space.

#### Scenario: Sidebar Grid Injection
- **WHEN** user visits NotebookLM
- **THEN** the system MUST inject a sidebar into `.welcome-page-container` using a Grid layout (`300px 1fr`).
- **AND** the sidebar MUST be scrollable and fixed.

#### Scenario: Collapse/Expand Sidebar
- **WHEN** user clicks the "Toggle Sidebar" button
- **THEN** the sidebar SHOULD collapse, and the notebook grid MUST expand.
- **AND** the state SHOULD be persisted to `chrome.storage.local`.

### Requirement: Folder CRUD & Nesting
Users SHALL be able to create and manage multi-level folder structures.

#### Scenario: Folder Hierarchy
- **GIVEN** a folder exists
- **WHEN** user selects "Create subfolder" from the context menu
- **THEN** a new folder MUST be nested within the parent.
- **AND** subfolders MUST be rendered with consistent indentation and hierarchical tree lines (`├──`, `└──`).

#### Scenario: Folder Actions
- **GIVEN** a folder in the sidebar
- **THEN** it MUST support: **Rename**, **Change Color**, **Delete**, and **Add Subfolder**.

### Requirement: Notebook Organization
The system SHALL enable seamless movement of notebooks into folders via drag-and-drop or explicit menus.

#### Scenario: Advanced Drag-and-Drop
- **WHEN** user drags a notebook over the sidebar
- **THEN** a compact "Small Drag Preview" SHOULD be shown.
- **AND** the target folder MUST show a "dashed outline" stable highlight (no flickering).
- **AND** dropping the item MUST move the notebook to the specific sub-folder (using `stopPropagation`).

#### Scenario: Native Menu ("Move to Folder")
- **WHEN** user clicks "More Actions" on a notebook card
- **THEN** a "Move to Folder" button MUST be injected into the native menu.
- **AND** clicking it MUST show a **Tree-style Folder Picker**.

#### Scenario: Prevent Duplicate Addition
- **WHEN** user attempts to add a notebook to a folder that already contains it (via Drag-and-Drop or Folder Picker)
- **THEN** the system MUST NOT add the notebook again.
- **AND** the system MUST show a localized informative feedback alert telling the user the item already exists in the target folder.

### Requirement: Robustness & Isolation
The system SHALL ensure features work correctly across sessions and accounts.

#### Scenario: Multi-user Auth Preservation
- **WHEN** navigating from the sidebar
- **THEN** the `authuser` URL parameter MUST be preserved to maintain correct Google session.

#### Scenario: Account Data Isolation
- **GIVEN** multiple Google accounts
- **WHEN** folder data is stored or retrieved
- **THEN** it MUST be scoped to the specific user email (e.g., `gvFolderDataNotebookLM:acct:{email}`).
- **AND** the system SHOULD retry account detection during UI refreshes.

## Design Patterns

### Reliable Tracking
- **Event Delegation**: Notebook identification uses container-level delegation for reliability after dynamic re-renders.
- **Heuristic ID Extraction**: Identification fallbacks to `jslog` attribute parsing for improved accuracy.
