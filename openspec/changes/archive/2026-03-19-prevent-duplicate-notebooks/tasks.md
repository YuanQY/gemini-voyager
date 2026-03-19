## 1. Logic & Testing Foundation

- [x] 1.1 **Task**: Ensure `handleDrop` in `src/pages/content/folder/notebooklm.ts` returns `false` on duplicate items.
      - **Verification**: Code review of `handleDrop`.
- [x] 1.2 **Task**: Add Unit Tests to `src/pages/content/folder/__tests__/notebooklm.test.ts` to verify `handleDrop` return value for successful vs duplicate additions.
      - **UT Requirement**: Test cases for `handleDrop` with same/different notebook IDs.

## 2. Localization Implementation (i18n)

- [x] 2.1 **Task**: Add `duplicate_notebook_error` key to all 10 locale files (`src/locales/*/messages.json`).
      - **Key Definition**: `"duplicate_notebook_error": { "message": "This notebook is already in the target folder." }` (translated to 10 languages).
- [x] 2.2 **Task**: Initialize i18n for the localized string in the component logic.

## 3. UI Feedback Integration

- [x] 3.1 **Task**: Update `showFolderPicker`'s button click handler to check the result of `handleDrop` and show a localized `alert()` if `false`.
      - **UT Requirement**: Mock `window.alert` and verify it's called on duplicate.
- [x] 3.2 **Task**: Update the `drop` event listener in `createFolderElement` to check the result of `handleDrop` and show a localized `alert()` if `false`.
      - **UT Requirement**: Verify signal path from event to alert call.

## 4. Final Verification & Quality Assurance

- [x] 4.1 **Task**: Manual verification of Drag-and-Drop duplicate behavior on `notebooklm.google.com`.
      - **Result**: Confirmed by user.
- [x] 4.2 **Task**: Manual verification of "Move to Folder" picker duplicate behavior on `notebooklm.google.com`.
      - **Result**: Confirmed by user.
- [x] 4.3 **Task**: Run full test suite with `bun run test` and ensure all tests pass.
      - **Result**: 16 tests passed.
