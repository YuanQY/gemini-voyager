## Why

Prevent users from creating duplicates when moving notebooks into folders, ensuring data consistency. Although the current code has a preliminary check, it needs to be formalized as a requirement through specification documents and provide clear UI feedback to avoid user confusion when an operation fails silently.

## What Changes

- **Core Logic**: Formalize the behavior of "prohibiting addition of existing notebooks to the target folder."
- **UI Feedback**: Provide visual feedback (e.g., alert/toast) when a user attempts to move/add a notebook that already exists in that folder.
- **Robustness**: Ensure both `handleDrop` and `showFolderPicker` logic paths handle duplicate scenarios properly.
- **i18n**: Add localized error messages for duplicate alerts.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `notebooklm-folders`: Added scenarios for duplicate prevention in the "Notebook Organization" section.

## Impact

- **Affected Code**: `handleDrop` and its callers in `src/pages/content/folder/notebooklm.ts`.
- **System Impact**: Improved robustness and UX for NotebookLM folder management.
- **I18n**: New message key in `src/locales/*/messages.json`.
