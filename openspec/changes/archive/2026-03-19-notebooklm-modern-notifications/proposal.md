## Why

The current `alert()`-based notification system in NotebookLM folders is outdated, intrusive, and provides poor UX. 
Especially for asynchronous operations like cloud synchronization (uploading and syncing from Drive), the lack of real-time progress indicators leads to user uncertainty about whether the action is active. 
A modern Toast message system will provide a non-blocking, responsive, and clear notification experience, improving the overall perceived quality of the extension.

## What Changes

- **Core Notification Shift**: Replace all existing `alert()` calls in `NotebookLMFolderManager` with a non-blocking Toast notification system.
- **Improved Async UX**: For Cloud Upload and Cloud Sync, implement "Processing" states using persistent Toast messages that update their status upon completion or failure.
- **Architectural Refactoring**: Promote the high-quality `StatusToastManager` from the `watermarkRemover` sub-module to a shared feature to avoid duplication and encourage consistency.
- **Enhanced Localization**: Introduce new i18n keys for "Processing" and "Operation Result" states in all 10 supported locales.

## Capabilities

### New Capabilities
- `shared-toast-service`: Promote the status toast implementation as a reusable system component.

### Modified Capabilities
- `notebooklm-folders`: Added notification and progress feedback requirements for folder and cloud sync operations.

## Impact

- **Affected Code**: `src/pages/content/folder/notebooklm.ts`, `src/pages/content/watermarkRemover/statusToast.ts` (moving to a shared location).
- **User Experience**: Smoother, less intrusive feedback on actions; clear progress tracking for cloud operations.
- **Consistency**: Centralized notification design across the extension.
