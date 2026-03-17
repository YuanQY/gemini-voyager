## ADDED Requirements

### Requirement: Multi-Site Content Script Routing
The system SHALL route content script initialization to the correct folder manager based on the current hostname.

#### Scenario: NotebookLM hostname detection
- **WHEN** the content script runs on `notebooklm.google.com`
- **THEN** it MUST start `NotebookLMFolderManager` instead of `FolderManager` or `AIStudioFolderManager`

#### Scenario: Existing site behavior unchanged
- **WHEN** the content script runs on `gemini.google.com`
- **THEN** it MUST start `FolderManager` with no behavioral changes

### Requirement: Per-Site Storage Keys
The system SHALL use distinct storage keys for each site's folder data to prevent cross-site data interference.

#### Scenario: Storage key isolation
- **GIVEN** folder data exists for Gemini under key `gvFolderData`
- **AND** folder data exists for AI Studio under key `gvFolderDataAIStudio`
- **WHEN** NotebookLM folder manager loads its data
- **THEN** it MUST use key `gvFolderDataNotebookLM` and MUST NOT read or modify the other keys

### Requirement: Shared Type Reuse
The system SHALL reuse existing `FolderData`, `Folder`, and `ConversationReference` types across all site-specific folder managers without modification.

#### Scenario: Type compatibility
- **WHEN** `NotebookLMFolderManager` creates folder data
- **THEN** the data MUST conform to the `FolderData` interface defined in `src/pages/content/folder/types.ts`
