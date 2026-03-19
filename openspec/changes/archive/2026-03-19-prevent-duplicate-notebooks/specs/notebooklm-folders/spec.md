## MODIFIED Requirements

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
