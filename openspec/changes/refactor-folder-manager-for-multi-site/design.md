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
- **Outcome (Completed)**: NotebookLM uses Angular with the following confirmed DOM structure:
  - **Root**: `<labs-tailwind-root>` → `<welcome-page>` → `.welcome-page-container` → `.all-projects-container`
  - **Notebook list container**: `.my-projects-container` → `<project-grid>` → `.project-grid-container`
  - **Each notebook card**: `<project-button class="project-button">` containing `<mat-card class="project-button-card">`
  - **Notebook ID**: Embedded in child element IDs as `id="project-{uuid}-title"` (e.g., `project-83d27ed3-f142-4c4c-9018-29deb0c076dc-title`). Also available via `aria-labelledby` on the primary `<button>` inside each card.
  - **Notebook Icon**: Extracted from `.project-button-box-icon` and synchronized to the folder reference.
  - **Notebook title**: `<span class="project-button-title">` inside each `<project-button>`
  - **Injection point**: Insert folder container before `<project-grid>` inside `.my-projects-container`
  - **No `href` links** on notebook cards — navigation is handled via Angular router, not anchor tags.

### 3. Storage Isolation via Separate Key
- **Why**: Consistent with how AI Studio uses `StorageKeys.FOLDER_DATA_AISTUDIO`.
- **Implementation**: Add `StorageKeys.FOLDER_DATA_NOTEBOOKLM` (e.g., `gvFolderDataNotebookLM`) to `src/core/types/common.ts`.
- **Alternatives**: Site-prefixed keys within a single namespace. (Rejected: current pattern is simpler and already proven.)

### 4. Rendering Strategy: Robust Rendering Engine & Persistent Observation
- **Why**: NotebookLM is a single-page application built with Angular. Component re-renders and route navigation can silently remove extension-injected DOM elements. A one-time injection approach is brittle.
- **Implementation**:
  - **Full Render Loop**: Instead of static HTML strings, the manager uses a `render()` method that clears and rebuilds the folder UI from `this.data` whenever changes occur.
  - **Persistent MutationObserver**: A global `MutationObserver` on `document.body` monitors for UI detachment or notebook list re-rendering. It automatically re-injects the folder UI and re-binds drag events if they are lost.
  - **gv-bound Flag**: Uses a data attribute (`data-gv-bound`) on notebook cards to track event binding state and prevent duplicate listeners during observer triggers.
- **Outcome**: Ensures the folder UI remains visible and functional across navigation and dynamic page updates.

## Risks / Trade-offs

- **[Risk] DOM Changes in NotebookLM** → **Mitigation**: Selectors used are Angular custom element names (`project-button`, `project-grid`) and stable CSS class names (`.my-projects-container`, `.project-grid-container`, `.project-button-title`). Notebook IDs are parsed from element `id` attributes following the pattern `project-{uuid}-{role}` — this is structurally tied to Angular's component identity and unlikely to change without major restructuring. All selector choices are documented for easy updates.
- **[Risk] Code Duplication** → **Mitigation**: Acceptable for now. Common utilities (`validateFolderData`, `DataBackupService`, `FolderData` types) are already shared. A future consolidation pass can extract more shared logic once 3+ site implementations clarify the true common interface.
- **[Trade-off] No Adapter Abstraction** → Simpler and safer now, but will require a separate refactoring effort if 4+ sites are needed.
