## 0. DOM Research (Prerequisite)

- [x] 0.1 Visit `https://notebooklm.google.com/` and document the notebook list DOM structure.
  - Record: container selector, notebook card selector, notebook ID extraction method (from `data-*` attributes, `href`, or other).
  - Record: layout type (grid vs. list), notebook title element selector.
  - **Verify**: Document at least 3 notebook cards to confirm selector stability.
  - **Output**: A markdown file in `openspec/changes/refactor-folder-manager-for-multi-site/` with findings.

- [x] 0.2 Identify the best injection point for folder UI on NotebookLM.
  - Record: Where the folder container should be inserted (before the notebook list? as a sidebar? as section headers within the grid?).
  - **Verify**: Manually test with DevTools by inserting a `<div>` at the candidate injection point.

## 1. Storage & Types Setup

- [x] 1.1 Add `FOLDER_DATA_NOTEBOOKLM` to `StorageKeys` in `src/core/types/common.ts`.
  - **Verify**: `bun run typecheck` passes.

- [x] 1.2 Add storage key default to `StorageService` if needed (follow the AI Studio pattern).
  - **Verify**: `bun run typecheck` passes.

## 2. Manifest & Entry Point

- [x] 2.1 Add `https://notebooklm.google.com/*` to `host_permissions` in `manifest.json` and `manifest.dev.json`.
  - **Verify**: `bun run build:chrome` succeeds.

- [x] 2.2 Add `https://notebooklm.google.com/*` to `content_scripts.matches` in `manifest.json` and `manifest.dev.json`.
  - **Verify**: `bun run build:chrome` succeeds.

- [x] 2.3 Add `notebooklm.google.com` hostname branch in `src/pages/content/index.tsx`.
  - Import and call `startNotebookLMFolderManager()` (stub for now).
  - Follow the same pattern as the AI Studio branch (L282-L308 in `index.tsx`).
  - **Verify**: `bun run typecheck` and `bun run build:chrome` pass.

## 3. NotebookLMFolderManager Core

- [x] 3.1 Create `src/pages/content/folder/notebooklm.ts` with `NotebookLMFolderManager` class.
  - Include: `init()`, `setupPersistentObserver()`, `render()` loop.
  - Include: `STORAGE_KEY` using the new `StorageKeys.FOLDER_DATA_NOTEBOOKLM`.
  - Reuse: `FolderData` type, `DataBackupService`, `validateFolderData()`.
  - **Verify**: `bun run typecheck` passes; `bun run build:chrome` succeeds.

- [x] 3.2 Write `vitest` unit test for `NotebookLMFolderManager` data load/save isolation.
  - Test: Loading data with NotebookLM storage key does not interfere with Gemini or AI Studio keys.
  - **Verify**: `bun run test` passes.

- [x] 3.3 Create `startNotebookLMFolderManager()` export function in `notebooklm.ts`.
  - Wire into `index.tsx` (replacing the stub from 2.3).
  - **Verify**: `bun run build:chrome` succeeds.

## 4. DOM Integration (selectors from Task 0)

- [x] 4.1 Implement `setupPersistentObserver()` and `refreshUI()` — continuously monitor for the notebook list container.
  - **Verify**: UI remains injected after simulated DOM updates.

- [x] 4.2 Implement `extractNotebookId(element)` — extract unique notebook ID from a notebook card element.
  - **Verify**: Unit test with mock DOM elements matching the real selectors found in Task 0.

- [x] 4.3 Implement `injectFolderUI()` and `render()` — rebuild the UI from scratch on each data change or observer trigger.
  - Include: folder header with "Folders" title and "Add Folder" button.
  - Include: full render loop generating folder and reference elements.
  - **Verify**: Visual check that UI updates immediately on data change.

- [x] 4.4 Synchronize notebook icons — extract from `.project-button-box-icon` and persist in folder references.
  - **Verify**: Folder items display the correct emoji matching the notebook card.

## 5. Folder CRUD Operations

- [x] 5.1 Implement `createFolder()`, `renameFolder()`, `deleteFolder()`.
- [x] 5.2 Implement folder context menu with actions: Create Subfolder, Rename, Change Color, Delete.
- [x] 5.3 Implement UI for nested folder rendering and indentation.
- [x] 5.4 Implement folder pinning logic and UI indicator.
  - Follow the same UX pattern as `AIStudioFolderManager` (inline rename, confirm dialog for delete).
  - **Verify**: Unit tests for each operation verifying `this.data` state mutations and `save()` calls.

- [x] 5.2 Implement `toggleFolder()` (expand/collapse).
  - **Verify**: Unit test verifying `isExpanded` state toggle and DOM re-render.

## 6. Drag & Drop

- [x] 6.1 Implement `makeNotebooksDraggable()` — attach `dragstart` handlers to notebook cards.
  - Set drag data with `conversationId`, `title`, `url` (matching `DragData` type).
  - **Verify**: Unit test verifying drag data format on dragstart event.

- [x] 6.2 Implement folder drop zone — attach `dragover`/`drop` handlers to folder elements.
  - On drop: add notebook to folder via `this.data.folderContents`, call `save()`, re-render.
  - **Verify**: Unit test simulating drop event and verifying data state mutation.

- [x] 6.3 Implement "remove from folder" (drag back to root or remove button).
  - **Verify**: Unit test verifying item removal from `folderContents`.

## 7. CSS Styling

- [x] 7.1 Add NotebookLM-specific CSS rules to `public/contentStyle.css`.
  - All classes prefixed with `gv-notebooklm-`.
  - Must work in both light and dark themes.
  - **Verify**: Visual inspection; `bun run build:chrome` succeeds.

## 8. Integration & E2E

- [x] 8.1 Manual E2E: Load extension on Chrome, visit `notebooklm.google.com`, verify folder UI appears.
- [x] 8.2 Manual E2E: Create a folder, drag a notebook into it, rename the folder, delete the folder.
- [x] 8.3 Manual E2E: Verify Gemini folder functionality is unaffected (no regression).
- [x] 8.4 Manual E2E: Verify AI Studio folder functionality is unaffected (no regression).
- [x] 8.5 Run full verification suite: `bun run typecheck && bun run lint && bun run test && bun run build:chrome`.
  - All 613 tests passed. Build succeeded.

## 9. i18n (if new keys needed)

- [x] 9.1 If any new i18n keys are introduced, add translations to all 10 locales in `src/locales/*/messages.json`.
  - **Verify**: `bun run build:chrome` succeeds; no missing key warnings.
