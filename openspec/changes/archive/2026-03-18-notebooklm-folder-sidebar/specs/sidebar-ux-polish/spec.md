## Requirements: Sidebar Toggle and Layout Polishing

Enhance the NotebookLM folder sidebar with a toggle mechanism and fix layout inconsistencies.

### Requirement: Sidebar Toggle Mechanism
Provide a way for users to hide the folder sidebar to maximize screen space for the notebook grid.

#### Scenario: Collapse Sidebar
- **WHEN** user clicks the "Toggle Sidebar" button (Icon: `menu` or `arrow_back_ios`)
- **THEN** the sidebar SHOULD collapse or move off-screen.
- **AND** the main notebook grid MUST expand to fill the remaining space.
- **AND** the collapsed state SHOULD be persisted to `chrome.storage.local`.

#### Scenario: Expand Sidebar
- **WHEN** user clicks the toggle button in the collapsed state
- **THEN** the sidebar SHOULD reappear in its original `320px` width.

### Requirement: Consistent Indentation & Icons
Ensure all items (subfolders and notebooks) at the same level have the same indentation and use consistent visual indicators.

#### Scenario: Align Subfolders and Notebooks
- **WHEN** a folder contains both subfolders and notebooks
- **THEN** their left alignment MUST be identical relative to the folder hierarchy.
- **AND** notebooks MUST NOT appear deeper than subfolders at the equal level.
- **AND** notebook items MUST display the same icon/emoji as their corresponding notebook card in the main grid.

### Requirement: Multi-user Support (AuthContext preservation)
Ensure notebook links in the sidebar correctly handle Google multi-login sessions.

#### Scenario: Open Notebook with authuser
- **WHEN** the current URL contains an `authuser` parameter (e.g., `?authuser=1`)
- **AND** the user clicks a notebook link in the sidebar
- **THEN** the target link MUST append the same `authuser` parameter to ensure the correct account session is used.

### Requirement: Native Menu Integration
Provide a seamless way to move notebooks into folders without leaving the main grid view.

#### Scenario: Move to Folder from Notebook Card
- **WHEN** user clicks the "More Actions" (three dots) menu on a notebook card
- **THEN** a "Move to Folder" menu item SHOULD be injected into the native Material menu.
- **AND** clicking this item MUST show a folder selection dialog.
- **AND** selecting a folder MUST move the notebook and refresh both the sidebar and the main UI if applicable.
- **AND** the folder selection list MUST display a **Tree-style Hierarchy** using monospace connection lines (`├──`, `└──`) and consistent indentation.
- **AND** account context MUST be automatically re-resolved during UI refreshes to handle slow-loading sessions.

### Requirement: Advanced Drag-and-Drop Interaction
Ensure a professional and stable drag-and-drop experience that handles complex folder structures.

#### Scenario: Drag Over Nested Folders
- **WHEN** a user drags an item over a folder tree
- **THEN** only the immediate target folder MUST be highlighted.
- **AND** the highlight MUST be stable (no flickering when moving over sub-elements).
- **AND** event bubbling MUST be prevented to ensure the item is dropped into the correct specific folder.

#### Scenario: Visual Drag Feedback
- **WHEN** a drag operation starts
- **THEN** a compact, non-obstructive "Small Drag Image" SHOULD be used instead of a full element ghost.
- **AND** the target folder SHOULD show a clear "dashed outline" and "background highlight" to confirm the drop zone.

### Design Pattern: Resourceful Tracking (Architectural Note)
- **Event Delegation**: To ensure reliability across Angular's dynamic re-renders, notebook information MUST be captured via event delegation on the main container rather than individual card bindings.
- **Heuristic ID Extraction**: Identification of notebooks SHOULD fallback to `jslog` attribute parsing if standard IDs are missing, as NotebookLM encodes project metadata there.
