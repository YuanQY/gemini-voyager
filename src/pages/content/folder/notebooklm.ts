import browser from 'webextension-polyfill';

import { DataBackupService } from '@/core/services/DataBackupService';
import { 
  accountIsolationService, 
  buildScopedFolderStorageKey, 
  detectAccountContextFromDocument 
} from '@/core/services/AccountIsolationService';
import { StorageKeys, type ConversationId, type FolderId } from '@/core/types/common';
import type { SyncAccountScope, PromptItem, SyncResponse } from '@/core/types/sync';
import { FolderImportExportService } from '@/features/folder/services/FolderImportExportService';
import type { FolderExportPayload } from '@/features/folder/types/import-export';
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
  private STORAGE_KEY: string = StorageKeys.FOLDER_DATA_NOTEBOOKLM;
  private COLLAPSED_STORAGE_KEY: string = 'gvNotebookLMSidebarCollapsed';
  private accountScope: SyncAccountScope | null = null;
  private isCollapsed: boolean = false;
  private backupService!: DataBackupService<FolderData>;
  private observer: MutationObserver | null = null;
  private activeColorPicker: HTMLElement | null = null;
  private activeColorPickerFolderId: string | null = null;
  private activeColorPickerCloseHandler: ((e: MouseEvent) => void) | null = null;
  private lastNotebookInfo: ConversationDragData | null = null;

  async init(): Promise<void> {
    console.log('[NotebookLMFolderManager] Starting robust init...');

    try {
      await initI18n();
      this.t = createTranslator();
    } catch (e) {
      console.error('[NotebookLMFolderManager] i18n init failed:', e);
    }

    if (location.hostname !== 'notebooklm.google.com') return;

    // Load collapsed state
    const collapsedResult = await chrome.storage.local.get(this.COLLAPSED_STORAGE_KEY);
    this.isCollapsed = collapsedResult[this.COLLAPSED_STORAGE_KEY] ?? true; // Default to collapsed

    await this.resolveAccountContext();

    // Initialize backup service
    this.backupService = new DataBackupService<FolderData>('notebooklm-folders', validateFolderData);
    this.backupService.setupBeforeUnloadBackup(() => this.data);

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

  private async resolveAccountContext(): Promise<void> {
    try {
      const context = await detectAccountContextFromDocument(window.location.href, document);
      if (context && context.email) {
        const oldKey = this.STORAGE_KEY;
        this.accountScope = {
          accountKey: context.email,
          accountId: 0,
          routeUserId: context.routeUserId
        };
        
        if (await accountIsolationService.isIsolationEnabled({ platform: 'notebooklm' })) {
          this.STORAGE_KEY = `${StorageKeys.FOLDER_DATA_NOTEBOOKLM}:acct:${context.email}`;
          if (oldKey !== this.STORAGE_KEY) {
            console.log('[NotebookLMFolderManager] Switched to isolated storage:', this.STORAGE_KEY);
            await this.load();
          }
        }
      }
    } catch (e) {
      console.warn('[NotebookLMFolderManager] Account context resolution failed:', e);
    }
  }

  /**
   * Check if UI needs injection or notebooks need drag bindings
   */
  private async refreshUI(): Promise<void> {
    // Retry account detection if not already resolved (handles slow-loading account buttons)
    if (!this.accountScope) {
      await this.resolveAccountContext();
    }

    const welcomeContainer = document.querySelector('.welcome-page-container') as HTMLElement;

    if (welcomeContainer) {
      if (!this.container || !document.contains(this.container)) {
        this.injectFolderUI(welcomeContainer);

        // Add delegated click listener to welcome container for robust notebook info capture
        // Only bind once to each container
        if (!welcomeContainer.dataset.gvNotebookTracking) {
          welcomeContainer.dataset.gvNotebookTracking = 'true';
          welcomeContainer.addEventListener('click', (e) => {
            const moreBtn = (e.target as HTMLElement).closest('.project-button-more');
            if (moreBtn) {
              const card = moreBtn.closest('project-button') as HTMLElement;
              if (card) {
                const id = this.extractNotebookId(card);
                if (id) {
                  const titleEl = card.querySelector('.project-button-title');
                  const title = titleEl ? (titleEl.textContent || '').trim() : 'Unknown';
                  const iconEl = card.querySelector('.project-button-box-icon');
                  const icon = iconEl ? (iconEl.textContent || '').trim() : undefined;
                  const url = `${window.location.origin}/notebook/${id}`;

                  this.lastNotebookInfo = {
                    type: 'conversation',
                    conversationId: id as ConversationId,
                    title,
                    url,
                    icon,
                  };
                  console.log('[NotebookLMFolderManager] Tracked notebook click:', title);
                }
              }
            }
          }, true); // Use capture phase
        }
      }
      this.makeNotebooksDraggable(welcomeContainer);
      this.checkAndInjectMenuAction();
    }
  }

  /**
   * Inject Move to folder into native menu
   */
  private checkAndInjectMenuAction() {
    const menu = document.querySelector('.mat-mdc-menu-content:not(.gv-injected)');
    if (menu && this.lastNotebookInfo) {
      menu.classList.add('gv-injected');
      
      const item = document.createElement('button');
      item.className = 'mat-mdc-menu-item mat-focus-indicator project-button-hamburger-menu-action gv-move-to-folder-btn';
      item.role = 'menuitem';
      item.innerHTML = `
        <mat-icon role="img" class="mat-icon notranslate google-symbols mat-icon-no-color" aria-hidden="true" style="margin-right: 8px;">folder</mat-icon>
        <span class="mat-mdc-menu-item-text">Move to Folder</span>
        <div class="mat-ripple mat-mdc-menu-ripple"></div>
      `;
      
      const notebook = { ...this.lastNotebookInfo };
      item.addEventListener('click', (e) => {
        console.log('[NotebookLMFolderManager] Move to folder clicked for:', notebook.title);
        e.preventDefault();
        e.stopPropagation();
        
        this.showFolderPicker(notebook);
        
        // Close the native menu by clicking the backdrop if it exists
        const backdrop = document.querySelector('.cdk-overlay-backdrop');
        if (backdrop instanceof HTMLElement) {
          backdrop.click();
        }
      });
      
      // Look for the specific container to ensure alignment
      const container = menu.querySelector('.project-button-hamburger-menu');
      if (container) {
        container.appendChild(item);
      } else {
        menu.appendChild(item);
      }
    }
  }

  private async showFolderPicker(notebook: ConversationDragData) {
    if (!notebook.conversationId) {
      console.warn('[NotebookLMFolderManager] Cannot show picker: no notebook info');
      return;
    }

    console.log('[NotebookLMFolderManager] Showing folder picker for:', notebook.title);
    
    // Always reload data before showing picker to ensure consistency, especially if sidebar was hidden
    await this.load();
    const folders = this.data.folders;
    
    // Remote any existing picker
    const existing = document.querySelector('.gv-folder-picker-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.className = 'gv-folder-picker-dialog';
    
    const title = document.createElement('h3');
    title.textContent = `Move "${notebook.title}" to...`;
    dialog.appendChild(title);

    if (folders.length === 0) {
      const msg = document.createElement('p');
      msg.textContent = 'No folders found. Please create a folder in the sidebar first.';
      msg.style.color = '#666';
      msg.style.fontSize = '14px';
      dialog.appendChild(msg);
    } else {
      const folderList = document.createElement('div');
      folderList.className = 'gv-folder-picker-list';
      
      // Render folder hierarchy recursively with tree lines
      const renderFolderBatch = (parentId: string | null, level: number, prefix: string = '') => {
        const batch = folders.filter(f => f.parentId === parentId);
        batch.forEach((f, index) => {
          const isLast = index === batch.length - 1;
          const currentPrefix = level === 0 ? '' : (isLast ? '└── ' : '├── ');
          const nextPrefix = level === 0 ? '' : prefix + (isLast ? '    ' : '│   ');

          const btn = document.createElement('button');
          btn.className = 'gv-folder-picker-item';
          btn.style.paddingLeft = `${level * 16 + 12}px`;
          
          btn.innerHTML = `
            <span class="gv-folder-picker-tree-line">${currentPrefix}</span>
            <span class="gv-folder-picker-icon">${f.color ? '●' : '📁'}</span>
            <span class="gv-folder-picker-name">${f.name}</span>
          `;
          
          if (f.color) {
            btn.style.setProperty('--folder-color', this.getFolderColorValue(f.color));
          }
          
          btn.addEventListener('click', async () => {
            console.log('[NotebookLMFolderManager] Target folder selected:', f.name);
            await this.handleDrop(f.id, JSON.stringify(notebook));
            dialog.remove();
            this.render();
          });
          folderList.appendChild(btn);
          
          // Render children with updated prefix
          renderFolderBatch(f.id, level + 1, nextPrefix);
        });
      };

      renderFolderBatch(null, 0);
      dialog.appendChild(folderList);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'gv-folder-picker-close';
    closeBtn.textContent = 'Cancel';
    closeBtn.onclick = () => dialog.remove();
    dialog.appendChild(closeBtn);

    document.body.appendChild(dialog);
    
    // Auto-close on outside click
    const handler = (e: MouseEvent) => {
      if (!dialog.contains(e.target as Node)) {
        dialog.remove();
        document.removeEventListener('mousedown', handler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
  }

  /**
   * Inject or re-inject the main folder container using Sidebar Layout
   */
  private injectFolderUI(welcomeContainer: HTMLElement): void {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'gv-notebooklm-folder-container';

      // Header structure following Gemini pattern
      const header = document.createElement('div');
      header.className = 'gv-notebooklm-folder-header';

      const titleContainer = document.createElement('div');
      titleContainer.className = 'title-container';
      const title = document.createElement('h1');
      title.className = 'gv-notebooklm-folder-title';
      title.textContent = this.t('folder_title') || 'Folders';
      titleContainer.appendChild(title);

      const actionGroup = document.createElement('div');
      actionGroup.className = 'gv-folder-header-actions';

      // Advanced Action Buttons with Inline SVGs
      const actions = [
        { 
          id: 'isolation', 
          title: 'Account Isolation', 
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' 
        },
        { 
          id: 'importexport', 
          title: 'Import/Export folders', 
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>' 
        },
        { 
          id: 'upload', 
          title: 'Upload to Cloud', 
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>' 
        },
        { 
          id: 'sync', 
          title: 'Sync from Cloud', 
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>' 
        },
        { 
          id: 'add', 
          title: 'Create folder', 
          isAdd: true,
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>' 
        }
      ];

      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = action.isAdd ? 'gv-folder-action-btn gv-folder-add-btn' : 'gv-folder-action-btn';
        btn.title = action.title;
        btn.innerHTML = action.icon;
        btn.onclick = (e) => {
          if (action.id === 'add') this.handleCreateFolder();
          else if (action.id === 'isolation') this.toggleIsolation();
          else if (action.id === 'importexport') this.showImportExportMenu(e);
          else if (action.id === 'upload') this.handleCloudUpload();
          else if (action.id === 'sync') this.handleCloudSync();
        };
        actionGroup.appendChild(btn);
      });

      header.appendChild(titleContainer);
      header.appendChild(actionGroup);

      // Add collapse button to header
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'gv-folder-action-btn gv-sidebar-collapse-btn';
      collapseBtn.title = 'Collapse Sidebar';
      collapseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>';
      collapseBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleSidebar();
      };
      header.prepend(collapseBtn);

      this.listElement = document.createElement('div');
      this.listElement.className = 'gv-notebooklm-folder-list';

      this.container.appendChild(header);
      this.container.appendChild(this.listElement);
      this.container.classList.add('sidebar-column'); // Add specific column class
    }

    // Apply sidebar layout class to the container
    if (welcomeContainer) {
      if (!welcomeContainer.classList.contains('gv-sidebar-layout')) {
        welcomeContainer.classList.add('gv-sidebar-layout');
      }
      
      // Update collapsed state on container
      if (this.isCollapsed) {
        welcomeContainer.classList.add('gv-sidebar-collapsed');
      } else {
        welcomeContainer.classList.remove('gv-sidebar-collapsed');
      }

      // Add floating toggle button when collapsed
      this.ensureToggleButton(welcomeContainer);

      // Ensure the folder container is the first child (sidebar column)
      if (this.container && (this.container.parentElement !== welcomeContainer || welcomeContainer.firstChild !== this.container)) {
        welcomeContainer.prepend(this.container);
      }
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

    // Context drop zone on the whole folder element for a larger target
    let dragCounter = 0;
    el.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      el.classList.add('gv-drag-over');
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      el.classList.add('gv-drag-over');
    });
    el.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        el.classList.remove('gv-drag-over');
      }
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      el.classList.remove('gv-drag-over');
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
    el.dataset.folderId = folderId;
    el.dataset.conversationId = ref.conversationId;

    // Draggable attributes
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      const dragData: ConversationDragData = {
        type: 'conversation',
        conversationId: ref.conversationId,
        title: ref.title,
        url: ref.url || `/notebook/${ref.conversationId}`,
        sourceFolderId: folderId as FolderId
      };
      e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
      el.classList.add('is-dragging');
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
    });

    // Icon (to align with folder toggle arrows)
    const icon = document.createElement('span');
    icon.className = 'gv-notebook-icon';
    if (ref.icon) {
      icon.textContent = ref.icon;
      icon.style.fontSize = '14px';
    } else {
      icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>';
    }
    el.appendChild(icon);

    const title = document.createElement('a');
    title.className = 'gv-ref-title';
    title.textContent = ref.title;
    
    // Fix authuser loss: include authuser from current search params
    const currentParams = new URLSearchParams(window.location.search);
    const authuser = currentParams.get('authuser');
    const notebookUrl = ref.url || `/notebook/${ref.conversationId}`;
    if (authuser) {
      const u = new URL(notebookUrl, window.location.origin);
      u.searchParams.set('authuser', authuser);
      title.href = u.toString();
    } else {
      title.href = notebookUrl;
    }
    el.appendChild(title);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'gv-ref-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove from folder';
    removeBtn.onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await this.removeFromFolder(folderId, ref.conversationId);
      this.render();
    };
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

  private setSmallDragImage(e: DragEvent, title: string): void {
    if (!e.dataTransfer) return;

    const ghost = document.createElement('div');
    ghost.style.cssText = `
      position: fixed;
      left: -1000px;
      top: -1000px;
      padding: 8px 12px;
      background: #e8f0fe;
      border: 1px solid #1a73e8;
      border-radius: 8px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: -1;
      pointer-events: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    ghost.innerHTML = `<span>📂</span> <span>${title}</span>`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 10, 10);
    setTimeout(() => ghost.remove(), 0);
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

        // Create a small ghost element for the drag image
        const ghost = document.createElement('div');
        ghost.style.cssText = `
          position: fixed;
          left: -1000px;
          top: -1000px;
          padding: 8px 12px;
          background: #e8f0fe;
          border: 1px solid #1a73e8;
          border-radius: 8px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: -1;
          pointer-events: none;
        `;
        ghost.innerHTML = `<span style="font-size: 16px;">${icon || '📁'}</span> <span>${title}</span>`;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 10, 10);
        // Remove ghost after drag starts
        setTimeout(() => ghost.remove(), 0);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('gv-dragging');
      });

      // Menu button click tracking
      const moreBtn = card.querySelector('.project-button-more');
      if (moreBtn) {
        moreBtn.addEventListener('click', () => {
          this.lastNotebookInfo = {
            type: 'conversation',
            conversationId: id as ConversationId,
            title,
            url,
            icon,
          };
        });
      }
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

    // New strategy: check jslog which often contains project IDs in NotebookLM
    const jslog = element.getAttribute('jslog');
    if (jslog) {
      // Look for sequences like 269415;...:abc-123-...
      const uuidPattern = /([a-f0-9-]{36})/;
      const match = jslog.match(uuidPattern);
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
    if (this.backupService) {
      this.backupService.createPrimaryBackup(this.data);
    }
  }

  destroy(): void {
    if (this.observer) this.observer.disconnect();
    if (this.container) this.container.remove();
    document.querySelector('.gv-sidebar-toggle-btn')?.remove();
  }

  /**
   * Sidebar Display Management
   */
  private toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    chrome.storage.local.set({ [this.COLLAPSED_STORAGE_KEY]: this.isCollapsed });
    
    const welcomeContainer = document.querySelector('.welcome-page-container');
    if (welcomeContainer) {
      if (this.isCollapsed) {
        welcomeContainer.classList.add('gv-sidebar-collapsed');
      } else {
        welcomeContainer.classList.remove('gv-sidebar-collapsed');
        this.render(); // Ensure fresh render when expanding
      }
      this.ensureToggleButton(welcomeContainer as HTMLElement);
    }
  }

  private ensureToggleButton(welcomeContainer: HTMLElement): void {
    let btn = document.querySelector('.gv-sidebar-toggle-btn') as HTMLElement;
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'gv-sidebar-toggle-btn';
      btn.title = 'Show Folders';
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z"/></svg>';
      btn.onclick = () => this.toggleSidebar();
      document.body.appendChild(btn);
    }
    
    // Only show when collapsed AND we are on desktop
    const isDesktop = window.innerWidth > 1024;
    btn.style.display = (this.isCollapsed && isDesktop) ? 'flex' : 'none';
  }

  /**
   * Toggle Isolation Setting (Simplified for Content Script)
   */
  private async toggleIsolation(): Promise<void> {
    const current = await accountIsolationService.isIsolationEnabled({ platform: 'notebooklm' });
    const newState = !current;
    
    await chrome.storage.sync.set({
      [StorageKeys.GV_ACCOUNT_ISOLATION_ENABLED_NOTEBOOKLM]: newState
    });
    
    alert(`Account Isolation ${newState ? 'Enabled' : 'Disabled'}. Please refresh the page to apply changes.`);
  }

  /**
   * Import/Export Dropdown
   */
  private showImportExportMenu(event: MouseEvent): void {
    event.stopPropagation();
    const menu = document.createElement('div');
    menu.className = 'gv-folder-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const items = [
      { label: this.t('folder_import') || 'Import Folders', action: () => this.handleImport() },
      { label: this.t('folder_export') || 'Export Folders', action: () => this.handleExport() }
    ];

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'gv-folder-menu-item';
      btn.textContent = item.label;
      btn.onclick = () => {
        item.action();
        menu.remove();
      };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      const close = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 0);
  }

  private async handleExport(): Promise<void> {
    const payload = FolderImportExportService.exportToPayload(this.data);
    FolderImportExportService.downloadJSON(payload, `notebooklm-folders-${new Date().getTime()}.json`);
  }

  private async handleImport(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const result = await FolderImportExportService.readJSONFile(file);
      if (result.success) {
        const validated = FolderImportExportService.validatePayload(result.data);
        if (validated.success) {
          const mergeResult = await FolderImportExportService.importFromPayload(validated.data, this.data, { strategy: 'merge' });
          if (mergeResult.success) {
            this.data = mergeResult.data.data;
            await this.save();
            this.render();
            alert('Import successful!');
          }
        } else {
          alert('Invalid file format');
        }
      }
    };
    input.click();
  }

  /**
   * Cloud Sync Implementation
   */
  private async handleCloudUpload(): Promise<void> {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'gv.sync.upload',
        payload: {
          folders: this.data,
          prompts: [], // NotebookLM doesn't have prompts yet in this context
          platform: 'notebooklm',
          accountScope: this.accountScope
        }
      })) as SyncResponse;

      if (response?.ok) {
        alert('Upload successful!');
      } else {
        alert(`Upload failed: ${response?.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert('Cloud upload failed. Check extension permissions.');
    }
  }

  private async handleCloudSync(): Promise<void> {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'gv.sync.download',
        payload: {
          platform: 'notebooklm',
          accountScope: this.accountScope
        }
      })) as SyncResponse;

      if (response?.ok && response.data?.folders) {
        const cloudData = response.data.folders.data;
        // Shallow merge folders
        const mergedFolders = [...this.data.folders];
        cloudData.folders.forEach((cf: Folder) => {
          if (!mergedFolders.find(f => f.id === cf.id)) {
            mergedFolders.push(cf);
          }
        });

        // Merge contents
        const mergedContents = { ...this.data.folderContents };
        Object.keys(cloudData.folderContents).forEach(fid => {
          if (!mergedContents[fid]) {
            mergedContents[fid] = cloudData.folderContents[fid];
          } else {
            const existingIds = new Set(mergedContents[fid].map(c => c.conversationId));
            cloudData.folderContents[fid].forEach((c: ConversationReference) => {
              if (!existingIds.has(c.conversationId)) {
                mergedContents[fid].push(c);
              }
            });
          }
        });

        this.data = { folders: mergedFolders, folderContents: mergedContents };
        await this.save();
        this.render();
        alert('Sync successful!');
      } else {
        alert(`Sync failed: ${response?.error || 'No data found'}`);
      }
    } catch (e) {
      alert('Cloud sync failed.');
    }
  }
}


// Styles injected via public/contentStyle.css

export async function startNotebookLMFolderManager(): Promise<NotebookLMFolderManager> {
  const manager = new NotebookLMFolderManager();
  await manager.init();
  return manager;
}
