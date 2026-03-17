# NotebookLM DOM Research

由于自动化浏览器检测不断失败 (503)，且 Headless 模式遇到登录墙，我们采用 Google Angular 应用的标准模式建立 robust 选择器。

## 1. Notebook Card (Item)

根据 Google Material Design 和 Angular 组件特征，NotebookLM 极有可能使用以下一种结构：
- 角色的 grid: `[role="gridcell"]` 
- 或者角色的 list: `[role="listitem"]`
- 或者是特定组件如: `.notebook-card`, `app-notebook-card`, `gmat-compact-notebook-tile`

我们将采用容错的复合选择器：
```css
a[href*="/notebook/"], a[href*="/project/"], [role="listitem"] a, [role="gridcell"] a
```
或者我们可以直接监听整个页面中的拖拽事件，或者寻找特定链接进行绑定。

提取 ID 的最佳方式是从 `href` 属性中提取。
例如：`href="/notebook/12345678-abcd-..."` -> `id = "12345678-abcd-..."`。

## 2. List Container (Injection Point)

容器通常是 `[role="main"]`, `[role="grid"]`, `[role="list"]` 或者包裹这些卡片的父级 `div`。
我们可以动态查找包含多个 notebook 链接的最上层公共父容器，并在其上方（`beforebegin`）插入 Folder UI。

## 后续验证

在 Task 8 手动 E2E 阶段，我们将直接在真实页面使用 DevTools 验证这些 fallback 选择器，并进行微调。由于独立出 `NotebookLMFolderManager`，修改选择器非常安全。
