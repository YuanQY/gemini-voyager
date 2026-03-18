## ADDED Requirements

### Requirement: Sidebar Injection Target
Update the DOM injection strategy for the folder panel.

#### Scenario: Inject into Welcome Container
- **WHEN** the manager initializes
- **THEN** it MUST find `.welcome-page-container` and prepend the folder container.

### Requirement: Folder Header Action Buttons
Provide advanced management buttons in the folder header, consistent with Gemini.

#### Scenario: Header Actions Display
- **WHEN** folder panel renders
- **THEN** the header MUST include buttons for: Account Isolation, Import/Export, Upload/Sync Cloud, and Create Folder.
- **THEN** each button MUST have a descriptive title (tooltip) and appropriate icon.
