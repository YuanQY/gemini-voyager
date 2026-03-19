# Tasks: notebooklm-modern-notifications

## Section 1: Shared Infrastructure Refactor
- [x] **Task 1.1**: Move `StatusToast.ts` from `watermarkRemover` to `src/features/common/ui/StatusToast.ts`.
  - [x] Status: `Complete`
  - [x] Verification: `File created and imports updated. Existing function verified.`
- [x] **Task 1.2**: Update `StatusToastManager` to support `pending` spinner and `updateLatestPending` method.
  - [x] Status: `Complete`
  - [x] Verification: `Spinner styling added and update methods implemented.`
- [x] **Task 1.3**: Pass unit tests for `StatusToastManager` (StatusToast.test.ts).
  - [x] Status: `Complete`
  - [x] Verification: `7/7 tests passed.`

## Section 2: i18n Localization
- [x] **Task 2.1**: Add `folder_cloud_upload_processing` and `folder_cloud_sync_processing` keys to English (`en`).
  - [x] Status: `Complete`
- [x] **Task 2.2**: Implement translations in all 10 locales (`en`, `ar`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`, `zh`, `zh_TW`).
  - [x] Status: `Complete`
  - [x] Verification: `Automated script used to fill all JSON files with accurate translations.`
- [x] **Task 2.3**: Update `createTranslator` and `t()` helper to support string replacements (e.g., `{folders}`).
  - [x] Status: `Complete`
  - [x] Verification: `src/utils/i18n.ts updated and tested.`

## Section 3: NotebookLM Business Integration
- [x] **Task 3.1**: Initialize `StatusToastManager` in `NotebookLMFolderManager.init()`.
  - [x] Status: `Complete`
- [x] **Task 3.2**: Replace all `alert()` calls with `this.toast.addToast()` in `notebooklm.ts`.
  - [x] Status: `Complete`
- [x] **Task 3.3**: Implement "Processing" feedback for Cloud Upload (Pending -> Success/Error).
  - [x] Status: `Complete`
- [x] **Task 3.4**: Implement "Processing" feedback for Cloud Sync (Pending -> Success/Error).
  - [x] Status: `Complete`
- [x] **Task 3.5**: Pass NotebookLM integration tests (`notebooklm.test.ts`).
  - [x] Status: `Complete`
  - [x] Verification: `16/16 tests passed with toast mocks.`

## Section 4: QA & Final Verification
- [x] **Task 4.1**: Verify dark/light mode CSS logic in `StatusToast.ts`.
  - [x] Status: `Complete`
  - [x] Verification: `Verified CSS specificity and system preference support.`
- [x] **Task 4.2**: Ensure no UI conflicts with NotebookLM's existing floating elements.
  - [x] Status: `Complete`
  - [x] Verification: `Using isolation: isolate and highest z-index.`

---
**Build Status**: `PASS (bun run build:chrome)`
**Test Status**: `PASS (vitest)`
