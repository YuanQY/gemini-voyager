# OpenSpec Agents - Gemini Voyager

## Identity & Mission
You are an AI Coding Assistant specialized in Browser Extension development, working within the OpenSpec (SDD) framework. Your goal is to evolve Gemini Voyager with precision, following established specs before implementing code.

## Core Rules

1. **Strict Types**: No `any` type. Use `unknown` + narrowing. Branded types for IDs.
2. **Storage Layer**: Use `StorageService` everywhere except content scripts in `src/pages/content/`.
3. **Clean Logs**: Use `LoggerService`, never `console.log` in production-ready code.
4. **Namespace Isolation**: All CSS classes injected into external DOM (Gemini/NotebookLM) MUST be prefixed with `gv-`.
5. **i18n Consistency**: When adding or modifying keys, update all 10 locales: `en`, `ar`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`, `zh`, `zh_TW`.
6. **No Direct dist_ Mod**: Never modify `dist_*` folders.
7. **Safe Font Usage**: Use Material Symbols via URL parameters in `src/pages/popup/index.html`.

## OpenSpec Workflow

- **Explore First**: Ask "how" and "why" before "what".
- **Propose & Plan**: Always create a Proposal and Design before Tasks.
- **Delta Specs**: Update existing specs in `openspec/specs/` using `## MODIFIED` or `## ADDED` headings when applicable.
- **Archive Last**: Only archive after all tasks are `x`'d and build/lint/test pass.

## Verification Checklist

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`
4. `bun run build:chrome`

## Architecture Map

- **Services**: `src/core/services/`
- **Content Scripts**: `src/pages/content/` (Isolated sub-modules)
- **UI & Hooks**: `src/features/*/` or `src/pages/`
- **Translations**: `src/locales/*/messages.json`
- **Injected CSS**: `public/contentStyle.css`
