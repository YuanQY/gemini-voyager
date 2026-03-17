## Why

User needs to organize notebooks in NotebookLM (notebooklm.google.com) using a folder structure similar to what gemini-voyager provides for Gemini and AI Studio. The project already supports multi-site folders via independent manager classes (`FolderManager` for Gemini, `AIStudioFolderManager` for AI Studio). Adding NotebookLM follows this established pattern.

## What Changes

- **New Module**: Create `NotebookLMFolderManager` in `src/pages/content/folder/notebooklm.ts`, following the same architectural pattern as `AIStudioFolderManager`.
- **Entry Point**: Update `src/pages/content/index.tsx` to conditionally start `NotebookLMFolderManager` on `notebooklm.google.com`.
- **Manifest**: Add `https://notebooklm.google.com/*` to `host_permissions` and `content_scripts`.
- **Shared Types**: Reuse existing `FolderData`, `Folder`, `ConversationReference` types from `src/pages/content/folder/types.ts`.

## Capabilities

### New Capabilities
- `notebooklm-folder-manager`: Folder management (create, rename, delete, drag-and-drop) for organizing notebooks on NotebookLM.

### Modified Capabilities
- None. Existing Gemini and AI Studio folder managers are not modified.

## Impact

- `src/pages/content/folder/notebooklm.ts`: New file — independent NotebookLM folder manager (similar to `aistudio.ts`).
- `src/pages/content/index.tsx`: Add `notebooklm.google.com` hostname branch.
- `manifest.json` / `manifest.dev.json`: Add host permission and content script match.
- `public/contentStyle.css`: Add NotebookLM-specific folder CSS (prefixed `gv-notebooklm`).
