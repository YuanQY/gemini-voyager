# Project Rules (Adapted from .claude/rules)

## TypeScript & React Standards
- **Apply to**: `src/**/*.ts`, `src/**/*.tsx`
- **DOs**:
  - Prefer plain objects with interfaces/types for data structures.
  - Use `map`, `filter`, `reduce` for immutability.
  - Use `private`/`protected` in classes.
  - Use `unknown` + narrowing (Zod or custom guards) for type safety.
  - Use named exports: `export function X`.
  - Functional React: hooks at top level, strictly functional components.
- **DON'Ts**:
  - **No `any` type.** Use `unknown` if you must, then narrow it.
  - **No global variables** outside defined Services.
  - **No `chrome.storage` in UI components** (`src/components/`, `src/pages/popup/`). Use `StorageService`.
  - **No God Components.** Business logic belongs in `features/*/services/` or custom hooks, not UI files.
  - **No magic strings.** Use constants or enums (StorageKeys, CSS classes).
  - **No `console.log` in production.** Use `LoggerService` for critical info.

## i18n / Translation Rules
- **Apply to**: `src/locales/**`
- **10 Locales**: `en`, `ar`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`, `zh`, `zh_TW`. All must be updated together.
- **Workflow**: 
  - English (`en`) is the source — write it first, then translate to all others.
  - Keys are flat strings in JSON, no nesting.
- **Quality**: 
  - Translations should be natural, not machine-literal.
  - Arabic (`ar`) is RTL — ensure UI handles it (see `src/core/utils/rtl.ts`).

## High-Complexity Modules (Edit with Caution)
- **Caution List**:
  - `StorageService`: Sync/local/session logic + migration.
  - `DataBackupService`: Multi-layer backup. Race conditions during unload.
  - `GoogleDriveSyncService`: OAuth2 cloud sync.
  - `AccountIsolationService`: Hard account isolation for multi-account.
  - `features/folder`: Drag-and-drop + cloud sync UI.
  - `features/export`: JSON/MD/PDF/Image export + Deep Research.
- **Before Modifying**:
  1. Read the entire file first.
  2. List all existing features that might be affected.
  3. Ensure zero destructiveness to user data.
  4. Run full test suite after changes.

## Content Script Rules
- **Apply to**: `src/pages/content/**`, `public/contentStyle.css`
- **CSS**:
  - All injected CSS classes MUST be prefixed with `gv-` (e.g., `.gv-rtl`).
  - Support both light and dark themes: use `.theme-host.light-theme` / `.theme-host.dark-theme` overrides, NOT `@media (prefers-color-scheme)`.
  - RTL layout: use `body.gv-rtl` selector for RTL overrides.
- **Storage**:
  - Content scripts use `chrome.storage` / `browser.storage` directly via `ExtGlobal` (Exception to the "use StorageService" rule).
- **DOM Injection**:
  - Each content script sub-module in `src/pages/content/` is self-contained.
  - Safari limitations: cloud sync, watermark removal, image export are disabled. Check `isSafari()` guards.
- **Icons**:
  - When adding new Material Symbols icons in popup, add the icon name to `icon_names=` in the Google Fonts URL in `src/pages/popup/index.html`.
