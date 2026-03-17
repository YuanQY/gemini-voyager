## ADDED Requirements

### Requirement: NotebookLM Folder Manager
The system SHALL provide a standalone folder management module for `notebooklm.google.com` that enables users to organize notebooks into folders, following the same independent-class architecture used by `AIStudioFolderManager`.

#### Scenario: Folder manager initialization
- **WHEN** user visits `https://notebooklm.google.com/`
- **THEN** the system MUST initialize `NotebookLMFolderManager` and establish a persistent `MutationObserver` to ensure the folder UI is injected and maintained across navigation.

#### Scenario: Data isolation
- **WHEN** user creates a folder on NotebookLM
- **THEN** the folder data MUST be stored under a NotebookLM-specific storage key, separate from Gemini and AI Studio folder data

### Requirement: Notebook Identification
The system SHALL extract unique identifiers for notebooks from their DOM elements to associate them with folders.

#### Scenario: Extract notebook ID
- **WHEN** a notebook element is rendered on the page
- **THEN** the manager MUST extract a stable unique ID from the element's attributes or child links

#### Scenario: Extract notebook icon
- **WHEN** a notebook is added to a folder
- **THEN** the system MUST extract the notebook's icon (e.g., emoji from `.project-button-box-icon`) and persist it to display consistent iconography in the folder list

### Requirement: Folder Context Menu
The system SHALL provide a context menu for each folder containing the following actions:
- **Unpin/Pin folder**: Toggle folder pinning status.
- **Create subfolder**: Create a new folder nested inside the current folder.
- **Rename**: Prompt for a new folder name.
- **Change Color**: Allow selecting a semantic color for the folder.
- **Delete**: Remove the folder and its contents.

### Requirement: Folder Nesting
The system SHALL support multi-level folder hierarchy (nested folders).
- Subfolders MUST be rendered with appropriate indentation within their parent folder.
- Dropping a notebook into a subfolder MUST correctly associate it with that subfolder.

### Requirement: Folder CRUD
The system SHALL support creating, renaming, deleting, and reordering folders within the NotebookLM folder UI.

#### Scenario: Create folder
- **WHEN** user clicks the "Add Folder" button
- **THEN** a new folder MUST be created, persisted to storage, and a full UI re-render MUST be triggered to update the folder list.

#### Scenario: Delete folder
- **WHEN** user deletes a folder
- **THEN** the folder MUST be removed from storage, and contained notebooks MUST be returned to the root level

### Requirement: Notebook Drag and Drop
The system SHALL allow users to drag notebooks into and out of folders.

#### Scenario: Drag notebook into folder
- **WHEN** user drags a notebook card and drops it onto a folder
- **THEN** the notebook MUST be added to that folder's contents and persisted to storage
