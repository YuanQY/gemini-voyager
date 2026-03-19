## Context

Currently, the `NotebookLMFolderManager` uses browser-native `alert()` for user feedback (e.g., success/fail on cloud sync, duplicate prevention). This provides an outdated and intrusive experience. The `watermarkRemover` sub-module already has a robust `StatusToastManager` that implements modern, non-blocking notifications with support for auto-dismiss, icon levels, and persistent "pending" states.

## Goals / Non-Goals

### Goals
- Centralize `StatusToastManager` into a shared feature.
- Migrate all `alert()` calls in `NotebookLMFolderManager` to use Toast notifications.
- Provide "Processing" visual feedback for long-running Cloud Sync actions.
- Full localization for all notification states.
- Atomic tasks with verifiable unit tests for logic and signal paths.

### Non-Goals
- Global automatic refactoring of ALL `alert()` calls in the entire extension (only focus on NotebookLM and shared infrastructure).
- Implementing complex progress percentages (simple "Processing" is enough).

## Decisions

### 1. Shared UI Infrastructure
Refactor `src/pages/content/watermarkRemover/statusToast.ts` into a decentralized feature at `src/features/common/ui/StatusToast.ts`. This ensures a single source of truth for modern notifications.

### 2. Notification Persistence Strategy
- **Instant Actions**: Use `autoDismissMs: 2200` for simple success alerts.
- **Errors**: Non-persistent but longer dismiss (`4000ms`) or until clicked.
- **Cloud Actions**: 
    1. Start with `pending: true` (which has a spinner/icon but NO auto-dismiss).
    2. After completion/failure, use `updateLatestPending` with `markFinal: true` and `autoDismissMs` set.

### 3. Localization
Introduce `processing` state i18n keys to provide feedback during network operations.

## Risks / Trade-offs

- **[Risk]** The Toast container might overlap with NotebookLM's own interface or native snackbars.
- **[Mitigation]** The shared `StatusToastManager` already uses a carefully chosen `z-index` and position. We will adjust the default position to avoid interfering with the sidebar if needed.

## Testability Plan

- **Unit Tests for Refactoring**: Ensure the moved `StatusToast.ts` works correctly in its new context without breaking existing watermarkRemover tests.
- **Integration Tests for NotebookLM**: Use Mocks for the Toast manager to verify that the start, success, and error signals are correctly routed from the manager's logic.
- **Async Signal Chain**: Verify that the "pending" toast is updated, not just created and then another added.
