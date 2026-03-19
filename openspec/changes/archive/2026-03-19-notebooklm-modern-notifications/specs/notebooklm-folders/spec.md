## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Notebook Organization
The system SHALL enable seamless movement of notebooks into folders via drag-and-drop or explicit menus, and MUST provide localized, non-blocking feedback for both successful and duplicate additions.

#### Scenario: Native Menu ("Move to Folder")
- **WHEN** user clicks "More Actions" on a notebook card
- **THEN** a "Move to Folder" button MUST be injected into the native menu.
- **AND** clicking it MUST show a **Tree-style Folder Picker**.
- **AND** it MUST provide a non-blocking Toast feedback upon completion.
