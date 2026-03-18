## Requirements: Sidebar Header Actions Functional Implementation

Implement the business logic for the Gemini-style action buttons in the NotebookLM sidebar header.

### Requirement: Account Isolation Support
The folder data MUST be scoped per-account if user has enabled "Account Isolation" in settings.

#### Scenario: Resolve Account Scope
- **WHEN** NotebookLM page initializes
- **THEN** it MUST use `AccountIsolationService` to detect the current user email/ID.
- **AND** it MUST derive a unique storage key (e.g., `gvFolderDataNotebookLM:acct:{hash}`).
- **AND** it MUST load data from this account-specific key instead of the global one.

### Requirement: Folder Import/Export
The "Import/Export" button MUST trigger a dropdown menu with secondary actions.

#### Scenario: Export Data
- **WHEN** user clicks "Export folders"
- **THEN** it MUST generate a JSON file containing all folders and notebook references.
- **AND** it MUST trigger a browser download.

#### Scenario: Import Data
- **WHEN** user selects a JSON file for import
- **THEN** it MUST merge the incoming data with the current local data (deduplicating by ID).
- **AND** it MUST refresh the UI.

### Requirement: Google Drive Sync
The "Cloud Upload" and "Cloud Sync" buttons MUST interact with the extension background service.

#### Scenario: Cloud Upload (Manual)
- **WHEN** user clicks "Upload to Cloud"
- **THEN** it MUST send `gv.sync.upload` message with current data and account scope.
- **AND** show a "Success" or "Error" notification.

#### Scenario: Cloud Sync (Merge)
- **WHEN** user clicks "Sync from Cloud"
- **THEN** it MUST send `gv.sync.download` message.
- **AND** perform a deep merge of remote folders/references into local storage.
- **AND** show "Sync successful" notification.
