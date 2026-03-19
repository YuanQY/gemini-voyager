## Context

NotebookLM folder management is handled by the `NotebookLMFolderManager` class. `handleDrop` already contains preliminary checks for duplicate notebook items, but it fails silently when triggered via UI actions (Folder Picker or Drag-and-Drop).

## Goals / Non-Goals

### Goals
- Ensure `handleDrop` reliability and consistent return value.
- Provide user-facing feedback for failed additions across all input methods.
- Document this behavior as a formal requirement.
- Use localization system for all user-facing messages.

### Non-Goals
- Global de-duplication across all folders (a notebook can exist in multiple folders, but not multiple times in the *same* folder).
- Major data model refactoring.

## Decisions

### 1. Unified Error Feedback
Instead of silenty failing, the system will use `window.alert()` with a localized message. 
Rationale: Consistent with existing error handling in `NotebookLMFolderManager` (e.g., cloud sync errors).
Message key: `duplicate_notebook_error`

### 2. Logic Layer Return Value
`handleDrop` will return `Promise<boolean>`:
- `true`: Successfully added.
- `false`: Already exists or error.

### 3. UI Layer Checks
- **showFolderPicker**: Check `handleDrop` result and show alert if false.
- **Folder List Drop Listener**: Check `handleDrop` result and show alert if false.

## Risks / Trade-offs

- **[Risk]** alert() can be intrusive.
- **[Mitigation]** Keep the message concise. This is an edge-case error path, so intrusive feedback is actually helpful to clarify why the dropped item disappeared.

## Testability Plan

- **Unit Tests**: Mock `window.alert` to verify that feedback is triggered on duplicate detection.
- **Integration Tests**: Verify the full path from drag-start to drop-fail-feedback.
