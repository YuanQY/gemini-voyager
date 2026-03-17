## Context

Currently, the project supports folder management on two Google products:
- **Gemini**: `FolderManager` in `src/pages/content/folder/manager.ts` (7296 lines, sidebar-based, uses `jslog` + `c_` ID extraction)
- **AI Studio**: `AIStudioFolderManager` in `src/pages/content/folder/aistudio.ts` (2712 lines, sidebar-based, uses prompt link `href` for ID extraction)

Both are independent classes that share the same `FolderData` type but have completely different DOM injection, ID extraction, and rendering logic. This change adds NotebookLM support following the same proven pattern.

## Goals / Non-Goals

**Goals:**
- Create an independent `NotebookLMFolderManager` class for `notebooklm.google.com`.
- Support folder CRUD (create, rename, delete, reorder) for organizing notebooks.
- Support drag-and-drop of notebooks into/out of folders.
- Ensure data isolation (separate storage key from Gemini and AI Studio).

**Non-Goals:**
- Refactoring `FolderManager` or `AIStudioFolderManager` into a shared base class (premature abstraction).
- Cross-site folder sharing or merging.
- Cloud sync for NotebookLM folders in this iteration (can be added later using the same pattern as AI Studio).

## Decisions

### 1. Independent Class (same pattern as AI Studio)
- **Why**: The existing `AIStudioFolderManager` proves this pattern works well. Each site has unique DOM structures, ID extraction, and rendering needs. Premature abstraction (Adapter Pattern) would require refactoring ~10000 lines of working code with high regression risk.
- **Implementation**: Create `NotebookLMFolderManager` in `src/pages/content/folder/notebooklm.ts`.
- **Alternatives**: Adapter Pattern with `IFolderAdapter`. (Rejected: contradicts existing architecture, high refactoring risk, premature given only 3 sites.)

### 2. DOM Research First
- **Why**: NotebookLM's DOM structure is unknown. Hard-coding selectors like `.notebook-grid` or `.notebook-card` without verification leads to brittle code.
- **Implementation**: A prerequisite research task to document NotebookLM's actual DOM selectors, notebook ID extraction method, and layout structure.
- **Rationale**: This information directly determines the implementation of ID extraction, container injection, and drag-and-drop logic.

### 3. Storage Isolation via Separate Key
- **Why**: Consistent with how AI Studio uses `StorageKeys.FOLDER_DATA_AISTUDIO`.
- **Implementation**: Add `StorageKeys.FOLDER_DATA_NOTEBOOKLM` (e.g., `gvFolderDataNotebookLM`) to `src/core/types/common.ts`.
- **Alternatives**: Site-prefixed keys within a single namespace. (Rejected: current pattern is simpler and already proven.)

### 4. Rendering Strategy: Determined by DOM Research
- **Why**: NotebookLM may use a grid layout, list layout, or something else entirely. The rendering approach must be decided after DOM research, not before.
- **Implementation**: Defer rendering design details to the DOM research outcome (Task 0).

## Risks / Trade-offs

- **[Risk] DOM Changes in NotebookLM** → **Mitigation**: Use stable selectors (e.g., `[role]`, `[data-*]`) over class names where possible. Document selector choices for easy updates.
- **[Risk] Code Duplication** → **Mitigation**: Acceptable for now. Common utilities (`validateFolderData`, `DataBackupService`, `FolderData` types) are already shared. A future consolidation pass can extract more shared logic once 3+ site implementations clarify the true common interface.
- **[Trade-off] No Adapter Abstraction** → Simpler and safer now, but will require a separate refactoring effort if 4+ sites are needed.
