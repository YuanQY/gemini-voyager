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
The system SHALL enable seamless movement of notebooks into folders via drag-and-drop or explicit menus, and MUST provide localized, non-blocking feedback for both successful and duplicate additions.

#### Scenario: Native Menu ("Move to Folder")
- **WHEN** user clicks "More Actions" on a notebook card
- **THEN** a "Move to Folder" button MUST be injected into the native menu.
- **AND** clicking it MUST show a **Tree-style Folder Picker**.
- **AND** it MUST provide a non-blocking Toast feedback upon completion.

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

### Requirement: Modern Notification Feedback
The system SHALL use a modern, non-blocking toast notification system for all NotebookLM folder operations, replacing intrusive native `alert()` dialogs.

#### Scenario: Visual Confirmation of Action
- **WHEN** user successfully Creates, Renames, Decuplicates, or Deletes a folder/notebook
- **THEN** a localized Toast notification MUST be displayed with a "Success" icon.
- **AND** it MUST auto-dismiss after a brief delay (e.g., 2200ms).

#### Scenario: Long-Running Operation Feedback
- **WHEN** user clicks "Upload to Cloud" or "Sync from Cloud"
- **THEN** a persistent "Processing" Toast notification MUST be immediately displayed with an "Info" level icon.
- **AND** it MUST NOT auto-dismiss until the operation succeeds or fails.
- **AND** upon completion, the Toast MUST update to "Success" or "Error" state/icon and then auto-dismiss after a delay.

#### Scenario: Error Feedback
- **WHEN** an operation fails (e.g., Cloud Sync error)
- **THEN** a Toast notification with an "Error" icon MUST be displayed showing the failure message.
- **AND** it SHOULD NOT auto-dismiss immediately to ensure user visibility.

## Design Patterns

### Reliable Tracking
- **Event Delegation**: Notebook identification uses container-level delegation for reliability after dynamic re-renders.
- **Heuristic ID Extraction**: Identification fallbacks to `jslog` attribute parsing for improved accuracy.
