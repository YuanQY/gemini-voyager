import browser from 'webextension-polyfill';

import { DataBackupService } from '@/core/services/DataBackupService';
import { StorageKeys, type ConversationId, type FolderId } from '@/core/types/common';
import { createTranslator, initI18n } from '@/utils/i18n';

import type { FolderData, Folder, ConversationDragData, ConversationReference } from '@/core/types/folder';

/**
 * Validate folder data structure
 */
function validateFolderData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.folders) && typeof d.folderContents === 'object';
}

export class NotebookLMFolderManager {
  private t: (key: string) => string = (k) => k;
  private data: FolderData = { folders: [], folderContents: {} };
  private container: HTMLElement | null = null;
  private listElement: HTMLElement | null = null;
  private readonly STORAGE_KEY = StorageKeys.FOLDER_DATA_NOTEBOOKLM;
  private backupService!: DataBackupService<FolderData>;
  private observer: MutationObserver | null = null;
  private activeColorPicker: HTMLElement | null = null;
  private activeColorPickerFolderId: string | null = null;
  private activeColorPickerCloseHandler: ((e: MouseEvent) => void) | null = null;

  async init(): Promise<void> {
    console.log('[NotebookLMFolderManager] Starting robust init...');

    try {
      await initI18n();
      this.t = createTranslator();
    } catch (e) {
      console.error('[NotebookLMFolderManager] i18n init failed:', e);
    }

    // Initialize backup service
    this.backupService = new DataBackupService<FolderData>('notebooklm-folders', validateFolderData);
    this.backupService.setupBeforeUnloadBackup(() => this.data);

    if (location.hostname !== 'notebooklm.google.com') return;

    await this.load();
    
    // Start persistent observer to ensure UI is injected and notebooks are draggable
    this.setupPersistentObserver();
    
    console.log('[NotebookLMFolderManager] Persistent observer started');
  }

  /**
   * Continuous DOM monitoring to handle Angular's dynamic updates
   */
  private setupPersistentObserver(): void {
    if (this.observer) this.observer.disconnect();

    this.observer = new MutationObserver(() => {
      this.refreshUI();
    });

    this.observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Initial trigger
    this.refreshUI();
  }

  /**
   * Check if UI needs injection or notebooks need drag bindings
   */
  private async refreshUI(): Promise<void> {
    const selectors = [
      '.project-grid-container',
      'project-grid',
      '.my-projects-container'
    ];

    let target: HTMLElement | null = null;
    for (const sel of selectors) {
      target = document.querySelector(sel);
      if (target) break;
    }

    if (target) {
      if (!this.container || !document.contains(this.container)) {
        this.injectFolderUI(target);
      }
      this.makeNotebooksDraggable(target);
    }
  }

  /**
   * Inject or re-inject the main folder container
   */
  private injectFolderUI(targetContainer: HTMLElement): void {
    // If container exists but was detached, we'll re-attach it.
    // Otherwise create it.
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'gv-notebooklm-folder-container';
      
      const header = document.createElement('div');
      header.className = 'gv-notebooklm-folder-header';
      
      const title = document.createElement('div');
      title.className = 'gv-notebooklm-folder-title';
      title.innerHTML = `📁 ${this.t('folder_title') || 'Folders'}`;
      
      const addBtn = document.createElement('button');
      addBtn.className = 'gv-notebooklm-add-folder-btn';
      addBtn.textContent = `+ ${this.t('folder_create') || 'New'}`;
      addBtn.onclick = () => this.handleCreateFolder();
      
      header.appendChild(title);
      header.appendChild(addBtn);
      
      this.listElement = document.createElement('div');
      this.listElement.className = 'gv-notebooklm-folder-list';
      
      this.container.appendChild(header);
      this.container.appendChild(this.listElement);
    }

    // Determine insertion point
    const myProjectsContainer = targetContainer.closest('.my-projects-container') ?? targetContainer.closest('.all-projects-container');
    const projectGrid = myProjectsContainer?.querySelector('project-grid') ?? targetContainer;

    if (myProjectsContainer && projectGrid) {
      if (this.container.nextSibling !== projectGrid) {
        myProjectsContainer.insertBefore(this.container, projectGrid);
      }
    } else {
      targetContainer.parentElement?.insertBefore(this.container, targetContainer);
    }

    this.render();
  }

  /**
   * Main render loop for folder list
   */
  render(): void {
    if (!this.listElement) return;
    this.listElement.innerHTML = '';

    if (this.data.folders.length === 0) {
      this.listElement.innerHTML = `<div class="gv-empty-state">${this.t('folder_empty') || 'No folders yet'}</div>`;
      return;
    }

    // Sort folders by creation time
    const sortedFolders = [...this.data.folders].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    // Separate pinned and unpinned folders
    const pinnedFolders = sortedFolders.filter(f => f.pinned && f.parentId === null);
    const regularFolders = sortedFolders.filter(f => !f.pinned && f.parentId === null);

    pinnedFolders.forEach(folder => {
      const folderEl = this.createFolderElement(folder, 0);
      this.listElement?.appendChild(folderEl);
    });

    if (pinnedFolders.length > 0 && regularFolders.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'gv-folder-separator';
      this.listElement.appendChild(separator);
    }

    regularFolders.forEach(folder => {
      const folderEl = this.createFolderElement(folder, 0);
      this.listElement?.appendChild(folderEl);
    });
  }

  private createFolderElement(folder: Folder, level: number): HTMLElement {
    const el = document.createElement('div');
    el.className = `gv-folder-item ${folder.isExpanded ? 'is-expanded' : ''} ${folder.pinned ? 'is-pinned' : ''}`;
    el.dataset.id = folder.id;
    el.style.setProperty('--folder-level', level.toString());

    // Header
    const header = document.createElement('div');
    header.className = 'gv-folder-header';
    if (folder.color) {
      header.style.borderLeft = `3px solid ${this.getFolderColorValue(folder.color)}`;
    }
    
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'gv-folder-toggle';
    toggleBtn.textContent = folder.isExpanded ? '▼' : '▶';
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleFolder(folder.id);
    };

    const name = document.createElement('span');
    name.className = 'gv-folder-name';
    name.textContent = `${folder.pinned ? '📌 ' : ''}${folder.name}`;
    name.ondblclick = () => this.handleRenameFolder(folder.id, folder.name);

    const actions = document.createElement('div');
    actions.className = 'gv-folder-actions';
    
    const menuBtn = document.createElement('button');
    menuBtn.className = 'gv-folder-menu-btn';
    menuBtn.innerHTML = '⋮';
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      this.showFolderMenu(e, folder.id);
    };

    header.appendChild(toggleBtn);
    header.appendChild(name);
    header.appendChild(actions);
    actions.appendChild(menuBtn);

    // Context drop zone
    header.addEventListener('dragover', (e) => {
      e.preventDefault();
      header.classList.add('gv-drag-over');
    });
    header.addEventListener('dragleave', () => header.classList.remove('gv-drag-over'));
    header.addEventListener('drop', async (e) => {
      e.preventDefault();
      header.classList.remove('gv-drag-over');
      const data = e.dataTransfer?.getData('application/json');
      if (data) {
        await this.handleDrop(folder.id, data);
        this.render();
      }
    });

    el.appendChild(header);

    // Contents
    if (folder.isExpanded) {
      const content = document.createElement('div');
      content.className = 'gv-folder-content';
      
      // Render Subfolders
      const subfolders = this.data.folders
        .filter(f => f.parentId === folder.id)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      
      subfolders.forEach((sub: Folder) => {
        content.appendChild(this.createFolderElement(sub, level + 1));
      });

      // Render Notebooks
      const items = this.data.folderContents[folder.id] || [];
      if (items.length === 0 && subfolders.length === 0) {
        content.innerHTML += `<div class="gv-empty-folder">${this.t('folder_empty_hint') || 'Drag notebooks here'}</div>`;
      } else {
        items.forEach(item => {
          const itemEl = this.createNotebookRefElement(folder.id, item);
          content.appendChild(itemEl);
        });
      }
      el.appendChild(content);
    }

    return el;
  }

  private createNotebookRefElement(folderId: string, ref: ConversationReference): HTMLElement {
    const el = document.createElement('div');
    el.className = 'gv-notebook-ref';
    
    const icon = document.createElement('span');
    icon.textContent = ref.icon || '📓';
    
    const title = document.createElement('a');
    title.className = 'gv-ref-title';
    title.textContent = ref.title;
    title.href = ref.url;
    title.onclick = (e) => {
      e.preventDefault();
      window.location.href = ref.url;
    };

    const removeBtn = document.createElement('button');
    removeBtn.className = 'gv-ref-remove';
    removeBtn.textContent = '×';
    removeBtn.onclick = async () => {
      await this.removeFromFolder(folderId, ref.conversationId);
      this.render();
    };

    el.appendChild(icon);
    el.appendChild(title);
    el.appendChild(removeBtn);
    
    return el;
  }

  /**
   * User Actions
   */
  private async handleCreateFolder() {
    const name = prompt(this.t('folder_name_prompt') || 'Enter folder name:');
    if (name) {
      await this.createFolder(name);
      this.render();
    }
  }

  private async handleRenameFolder(id: string, oldName: string) {
    const name = prompt(this.t('folder_name_prompt') || 'Rename folder:', oldName);
    if (name && name !== oldName) {
      await this.renameFolder(id, name);
      this.render();
    }
  }

  private async handleDeleteFolder(id: string) {
    if (confirm(this.t('folder_delete_confirm') || 'Delete this folder?')) {
      await this.deleteFolder(id);
      this.render();
    }
  }

  private showFolderMenu(event: MouseEvent, folderId: string): void {
    const folder = this.data.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const menu = document.createElement('div');
    menu.className = 'gv-folder-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const menuItems = [
      {
        label: folder.pinned ? this.t('folder_unpin') : this.t('folder_pin'),
        action: () => this.togglePinFolder(folderId),
      },
      { label: this.t('folder_create_subfolder'), action: () => this.handleCreateSubfolder(folderId) },
      { label: this.t('folder_rename'), action: () => this.handleRenameFolder(folderId, folder.name) },
      { label: this.t('folder_change_color'), action: () => this.showColorPicker(folderId, event) },
      { label: this.t('folder_delete'), action: () => this.handleDeleteFolder(folderId) },
    ];

    menuItems.forEach((item) => {
      const menuItem = document.createElement('button');
      menuItem.className = 'gv-folder-menu-item';
      menuItem.textContent = item.label;
      menuItem.addEventListener('click', () => {
        item.action();
        menu.remove();
      });
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private async handleCreateSubfolder(parentId: string) {
    const name = prompt(this.t('folder_name_prompt') || 'Enter subfolder name:');
    if (name) {
      await this.createFolder(name, parentId);
      this.render();
    }
  }

  private showColorPicker(folderId: string, event: MouseEvent): void {
    if (this.activeColorPicker) {
      this.activeColorPicker.remove();
      if (this.activeColorPickerCloseHandler) {
        document.removeEventListener('click', this.activeColorPickerCloseHandler);
      }
    }

    const dialog = document.createElement('div');
    dialog.className = 'gv-color-picker-dialog';
    dialog.style.position = 'fixed';
    dialog.style.left = `${event.clientX + 10}px`;
    dialog.style.top = `${event.clientY}px`;
    dialog.style.zIndex = '10001';

    const colors = [
      { id: 'default', color: '#6b7280' },
      { id: 'red', color: '#ef4444' },
      { id: 'orange', color: '#f97316' },
      { id: 'yellow', color: '#eab308' },
      { id: 'green', color: '#22c55e' },
      { id: 'blue', color: '#3b82f6' },
      { id: 'purple', color: '#a855f7' },
    ];

    colors.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'gv-color-picker-item';
      btn.style.backgroundColor = c.color;
      btn.onclick = async () => {
        await this.setFolderColor(folderId, c.id);
        dialog.remove();
        this.render();
      };
      dialog.appendChild(btn);
    });

    document.body.appendChild(dialog);
    this.activeColorPicker = dialog;

    this.activeColorPickerCloseHandler = (e: MouseEvent) => {
      if (!dialog.contains(e.target as Node)) {
        dialog.remove();
        document.removeEventListener('click', this.activeColorPickerCloseHandler!);
        this.activeColorPicker = null;
      }
    };
    setTimeout(() => document.addEventListener('click', this.activeColorPickerCloseHandler!), 0);
  }

  private getFolderColorValue(colorId: string): string {
    const colors: Record<string, string> = {
      default: '#6b7280',
      red: '#ef4444',
      orange: '#f97316',
      yellow: '#eab308',
      green: '#22c55e',
      blue: '#3b82f6',
      purple: '#a855f7',
    };
    return colors[colorId] || colors.default;
  }

  /**
   * Drag & Drop Logic
   */
  private makeNotebooksDraggable(container: HTMLElement): void {
    const cards = container.querySelectorAll<HTMLElement>('project-button');
    cards.forEach(card => {
      if (card.dataset.gvBound) return;
      
      const id = this.extractNotebookId(card);
      if (!id) return;
      
      const titleEl = card.querySelector('.project-button-title');
      const title = titleEl ? (titleEl.textContent || '').trim() : 'Unknown';
      const url = `${window.location.origin}/notebook/${id}`;

      // Extract icon/emoji from card
      const iconEl = card.querySelector('.project-button-box-icon');
      const icon = iconEl ? (iconEl.textContent || '').trim() : undefined;

      card.setAttribute('draggable', 'true');
      card.dataset.gvBound = 'true';
      
      card.addEventListener('dragstart', (e) => {
        if (!e.dataTransfer) return;
        const dragData: ConversationDragData = {
          type: 'conversation',
          conversationId: id as ConversationId,
          title,
          url,
          icon,
        };
        e.dataTransfer.setData('application/json', JSON.stringify(dragData));
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('gv-dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('gv-dragging');
      });
    });
  }

  private extractNotebookId(element: HTMLElement): string | null {
    const idPattern = /project-([a-f0-9-]{36})/;
    const selfMatch = element.id?.match(idPattern);
    if (selfMatch) return selfMatch[1];

    const childWithId = element.querySelector('[id*="project-"]');
    if (childWithId) {
      const childMatch = childWithId.id.match(idPattern);
      if (childMatch) return childMatch[1];
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const match = labelledBy.match(idPattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Data Operations
   */
  async handleDrop(folderId: string, dragDataJson: string): Promise<boolean> {
    try {
      const parsedData = JSON.parse(dragDataJson) as Partial<ConversationDragData>;
      if (parsedData.type !== 'conversation' || !parsedData.conversationId) return false;

      const notebookId = parsedData.conversationId;
      if (!this.data.folderContents[folderId]) this.data.folderContents[folderId] = [];
      
      const list = this.data.folderContents[folderId];
      if (list.some(item => item.conversationId === notebookId)) return false;

      list.push({
        conversationId: notebookId as ConversationId,
        title: parsedData.title || 'Unknown',
        url: parsedData.url || '',
        icon: parsedData.icon,
        addedAt: Date.now()
      });

      await this.save();
      return true;
    } catch { return false; }
  }

  async createFolder(name: string, parentId: string | null = null): Promise<void> {
    const newFolder: Folder = {
      id: crypto.randomUUID() as FolderId,
      name: name.trim() || 'New Folder',
      parentId: parentId as FolderId | null,
      isExpanded: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
    };
    this.data.folders.push(newFolder);
    this.data.folderContents[newFolder.id] = [];
    await this.save();
  }

  async renameFolder(id: string, name: string): Promise<void> {
    const folder = this.data.folders.find(f => f.id === id);
    if (folder) {
      folder.name = name;
      folder.updatedAt = Date.now();
      await this.save();
    }
  }

  async deleteFolder(id: string): Promise<void> {
    this.data.folders = this.data.folders.filter(f => f.id !== id);
    delete this.data.folderContents[id];
    await this.save();
  }

  async toggleFolder(id: string): Promise<void> {
    const folder = this.data.folders.find(f => f.id === id);
    if (folder) {
      folder.isExpanded = !folder.isExpanded;
      await this.save();
      this.render();
    }
  }

  async removeFromFolder(folderId: string, notebookId: string): Promise<void> {
    const list = this.data.folderContents[folderId];
    if (list) {
      this.data.folderContents[folderId] = list.filter(item => item.conversationId !== notebookId);
      await this.save();
    }
  }

  async togglePinFolder(id: string): Promise<void> {
    const folder = this.data.folders.find(f => f.id === id);
    if (folder) {
      folder.pinned = !folder.pinned;
      await this.save();
      this.render();
    }
  }

  async setFolderColor(id: string, color: string): Promise<void> {
    const folder = this.data.folders.find(f => f.id === id);
    if (folder) {
      folder.color = color;
      await this.save();
    }
  }

  async load(): Promise<void> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    const data = result[this.STORAGE_KEY];
    if (data && validateFolderData(data)) {
      this.data = data;
    }
  }

  async save(): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: this.data });
    this.backupService.createPrimaryBackup(this.data);
  }

  destroy(): void {
    if (this.observer) this.observer.disconnect();
    if (this.container) this.container.remove();
  }
}


// Styles for NotebookLM Folder UI
const styles = `
  .gv-notebooklm-folder-container {
    margin: 20px 0;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 12px;
    border: 1px solid #e0e0e0;
  }
  .gv-notebooklm-folder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .gv-notebooklm-folder-title {
    font-weight: 600;
    font-size: 16px;
    color: #3c4043;
  }
  .gv-notebooklm-add-folder-btn {
    background: #1a73e8;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 13px;
  }
  .gv-folder-item {
    margin-bottom: 4px;
    border-radius: 8px;
    overflow: hidden;
  }
  .gv-folder-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: white;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
    margin-left: calc(var(--folder-level, 0) * 16px);
  }
  .gv-folder-header:hover {
    background: #f1f3f4;
  }
  .gv-folder-header.gv-drag-over {
    background: #e8f0fe;
    border: 1px dashed #1a73e8;
  }
  .gv-folder-toggle {
    margin-right: 8px;
    font-size: 10px;
    color: #5f6368;
    width: 14px;
  }
  .gv-folder-name {
    flex: 1;
    font-size: 14px;
    color: #3c4043;
  }
  .gv-folder-actions {
    display: flex;
    gap: 4px;
  }
  .gv-folder-menu-btn {
    background: transparent;
    border: none;
    color: #5f6368;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .gv-folder-menu-btn:hover {
    background: #dadce0;
  }
  .gv-folder-content {
    margin-top: 2px;
  }
  .gv-notebook-ref {
    display: flex;
    align-items: center;
    padding: 6px 12px 6px calc((var(--folder-level, 0) + 1) * 16px + 12px);
    gap: 8px;
    transition: background 0.2s;
  }
  .gv-notebook-ref:hover {
    background: #f1f3f4;
  }
  .gv-ref-title {
    flex: 1;
    font-size: 13px;
    color: #1a73e8;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gv-ref-remove {
    opacity: 0;
    background: transparent;
    border: none;
    color: #5f6368;
    cursor: pointer;
    font-size: 16px;
  }
  .gv-notebook-ref:hover .gv-ref-remove {
    opacity: 1;
  }
  .gv-folder-separator {
    height: 1px;
    background: #e0e0e0;
    margin: 8px 0;
  }
  .gv-empty-folder, .gv-empty-state {
    font-size: 12px;
    color: #80868b;
    padding: 8px 12px;
    font-style: italic;
  }
`;

if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

export async function startNotebookLMFolderManager(): Promise<NotebookLMFolderManager> {
  const manager = new NotebookLMFolderManager();
  await manager.init();
  return manager;
}
