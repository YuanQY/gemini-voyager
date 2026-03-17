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

    sortedFolders.forEach(folder => {
      const folderEl = this.createFolderElement(folder);
      this.listElement?.appendChild(folderEl);
    });
  }

  private createFolderElement(folder: Folder): HTMLElement {
    const el = document.createElement('div');
    el.className = `gv-folder-item ${folder.isExpanded ? 'is-expanded' : ''}`;
    el.dataset.id = folder.id;

    // Header
    const header = document.createElement('div');
    header.className = 'gv-folder-header';
    
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'gv-folder-toggle';
    toggleBtn.textContent = folder.isExpanded ? '▼' : '▶';
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleFolder(folder.id);
    };

    const name = document.createElement('span');
    name.className = 'gv-folder-name';
    name.textContent = folder.name;
    name.ondblclick = () => this.handleRenameFolder(folder.id, folder.name);

    const actions = document.createElement('div');
    actions.className = 'gv-folder-actions';
    
    const delBtn = document.createElement('button');
    delBtn.className = 'gv-folder-del-btn';
    delBtn.innerHTML = '🗑️';
    delBtn.title = this.t('folder_delete');
    delBtn.onclick = (e) => {
      e.stopPropagation();
      this.handleDeleteFolder(folder.id);
    };

    header.appendChild(toggleBtn);
    header.appendChild(name);
    header.appendChild(actions);
    actions.appendChild(delBtn);

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
      
      const items = this.data.folderContents[folder.id] || [];
      if (items.length === 0) {
        content.innerHTML = `<div class="gv-empty-folder">${this.t('folder_empty_hint') || 'Drag notebooks here'}</div>`;
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

  async createFolder(name: string): Promise<void> {
    const newFolder: Folder = {
      id: crypto.randomUUID() as FolderId,
      name: name.trim() || 'New Folder',
      parentId: null,
      isExpanded: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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

export async function startNotebookLMFolderManager(): Promise<NotebookLMFolderManager> {
  const manager = new NotebookLMFolderManager();
  await manager.init();
  return manager;
}
