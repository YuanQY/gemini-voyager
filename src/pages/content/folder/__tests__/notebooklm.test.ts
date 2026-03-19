import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotebookLMFolderManager } from '../notebooklm';
import { StorageKeys } from '@/core/types/common';

// Mock browser global object
declare global {
  var browser: any;
  // chrome is already declared by @types/chrome
}

vi.mock('@/utils/i18n', () => ({
  initI18n: vi.fn(() => Promise.resolve()),
  createTranslator: vi.fn(() => (k: string) => k),
}));

vi.mock('@/features/common/ui/StatusToast', () => ({
  createStatusToastManager: vi.fn(() => ({
    addToast: vi.fn(),
    removeToast: vi.fn(),
    updateToast: vi.fn(),
    updateLatestPending: vi.fn(),
    setAnchorElement: vi.fn(),
    getToastElements: vi.fn(() => []),
  })),
}));

vi.mock('@/core/services/AccountIsolationService', () => ({
  detectAccountContextFromDocument: vi.fn(() => Promise.resolve({ email: 'test@example.com', routeUserId: '123' })),
  accountIsolationService: {
    isIsolationEnabled: vi.fn(() => Promise.resolve(false)),
  },
  buildScopedFolderStorageKey: vi.fn((key: string) => `${key}:scoped`),
}));

beforeEach(() => {
  // Mock console to keep test output clean
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // Set hostname to simulate being on NotebookLM
  Object.defineProperty(window, 'location', {
    value: { hostname: 'notebooklm.google.com' },
    writable: true,
  });

  // Provide dummy DOM element so waitForNotebookList resolves immediately
  const dummyMain = document.createElement('div');
  dummyMain.className = 'project-grid-container';
  dummyMain.id = 'dummy-main';
  document.body.appendChild(dummyMain);

  // Mock chrome storage
  const mockStorage: Record<string, any> = {};
  (global as any).chrome = {
    storage: {
      local: {
        get: vi.fn((key: string | string[]) => {
          if (Array.isArray(key)) {
            const res: Record<string, any> = {};
            key.forEach((k) => (res[k] = mockStorage[k]));
            return Promise.resolve(res);
          }
          return Promise.resolve({ [key]: mockStorage[key] });
        }),
        set: vi.fn((data: Record<string, any>) => {
          Object.assign(mockStorage, data);
          return Promise.resolve();
        }),
      },
      sync: {
        get: vi.fn(() => Promise.resolve({})),
      },
    },
  };
});

let managers: NotebookLMFolderManager[] = [];

afterEach(() => {
  managers.forEach(m => m.destroy());
  managers = [];
  vi.restoreAllMocks();
  const dummyMain = document.getElementById('dummy-main');
  if (dummyMain) dummyMain.remove();
});

describe('NotebookLMFolderManager', () => {
  describe('Initialization and Storage Isolation', () => {
    it('initializes only on notebooklm.google.com', async () => {
      // Test NotebookLM host
      const manager1 = new NotebookLMFolderManager();
      managers.push(manager1);
      await manager1.init();
      // Wait for any background promises to settle
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(chrome.storage.local.get).toHaveBeenCalledWith(StorageKeys.FOLDER_DATA_NOTEBOOKLM);

      vi.clearAllMocks();

      // Test Gemini host
      Object.defineProperty(window, 'location', { value: { hostname: 'gemini.google.com' } });
      const manager2 = new NotebookLMFolderManager();
      managers.push(manager2);
      await manager2.init();
      // Should not call storage load if not on notebooklm
      expect(chrome.storage.local.get).not.toHaveBeenCalled();
    });

    it('loads and saves data using the isolated NotebookLM storage key', async () => {
      // Simulate existing AI Studio and Gemini data to prove isolation
      const geminiData = { folders: [{ id: 'gemini-folder', name: 'Gemini' }], folderContents: {} };
      const aiStudioData = { folders: [{ id: 'aistudio-folder', name: 'AI Studio' }], folderContents: {} };
      const notebookLMData = { folders: [{ id: 'nl-folder', name: 'NotebookLM' }], folderContents: {} };

      global.chrome.storage.local.set({
        [StorageKeys.FOLDER_DATA]: geminiData,
        [StorageKeys.FOLDER_DATA_AISTUDIO]: aiStudioData,
        [StorageKeys.FOLDER_DATA_NOTEBOOKLM]: notebookLMData,
      });

      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.init();

      // Ensure it loaded using its own specific key
      expect(chrome.storage.local.get).toHaveBeenCalledWith(StorageKeys.FOLDER_DATA_NOTEBOOKLM);

      // Mutate data via internal accessor or by verifying save overwrites correctly
      // (Since data is private, we trick save() into writing something new)
      // We can create a folder later, but for now just call save directly
      await manager.save();

      // Ensure the save didn't wipe the other keys
      const allStorage = await chrome.storage.local.get([
        StorageKeys.FOLDER_DATA,
        StorageKeys.FOLDER_DATA_AISTUDIO,
      ]);
      expect(allStorage[StorageKeys.FOLDER_DATA]).toEqual(geminiData);
      expect(allStorage[StorageKeys.FOLDER_DATA_AISTUDIO]).toEqual(aiStudioData);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [StorageKeys.FOLDER_DATA_NOTEBOOKLM]: notebookLMData
        })
      );
    });

    it('initializes with empty data if storage is corrupt or missing', async () => {
      global.chrome.storage.local.set({
        [StorageKeys.FOLDER_DATA_NOTEBOOKLM]: { invalid: 'data' }, // missing 'folders'
      });

      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.init();
      
      await manager.save();
      // It should have reset to default
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [StorageKeys.FOLDER_DATA_NOTEBOOKLM]: { folders: [], folderContents: {} },
      });
    });
  });

  describe('DOM Integration Methods', () => {
    it('extractNotebookId correctly extracts ID from element attributes', () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      
      // Strategy: child element with project- grid ID
      const el = document.createElement('div');
      el.id = 'project-83d27ed3-f142-4c4c-9018-29deb0c076dc';
      expect((manager as any).extractNotebookId(el)).toBe('83d27ed3-f142-4c4c-9018-29deb0c076dc');

      // Strategy 2: aria-labelledby referencing project id
      const el2 = document.createElement('button');
      el2.setAttribute('aria-labelledby', 'project-afd2f0cf-4553-4f6a-8609-761aa55dbc05-title');
      expect((manager as any).extractNotebookId(el2)).toBe('afd2f0cf-4553-4f6a-8609-761aa55dbc05');

      // No ID present
      const el3 = document.createElement('div');
      expect((manager as any).extractNotebookId(el3)).toBeNull();
    });

    it('injectFolderUI creates header and title', () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      // Initialize internal translator mock manually for the test
      (manager as any).t = (k: string) => k;
      
      const target = document.createElement('div');
      document.body.appendChild(target);
      
      (manager as any).injectFolderUI(target);
      
      const container = document.querySelector('.gv-notebooklm-folder-container');
      expect(container).toBeTruthy();
      expect(container?.querySelector('.gv-notebooklm-folder-title')?.textContent).toContain('folder_title');
      
      container?.remove();
      target.remove();
    });
  });

  describe('Folder CRUD Operations', () => {
    it('createFolder adds a folder', async () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.createFolder('My Folder');
      
      // @ts-ignore
      const folder = manager.data.folders[0];
      expect(folder).toBeTruthy();
      expect(folder.name).toBe('My Folder');
      // @ts-ignore
      expect(manager.data.folderContents[folder.id]).toEqual([]);
    });

    it('renameFolder renames an existing folder', async () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.createFolder('Old Name');
      // @ts-ignore
      const folderId = manager.data.folders[0].id;
      
      await manager.renameFolder(folderId, 'New Name');
      
      // @ts-ignore
      const renamed = manager.data.folders[0];
      expect(renamed.name).toBe('New Name');
    });

    it('deleteFolder deletes a folder and its contents reference', async () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.createFolder('To Delete');
      // @ts-ignore
      const folderId = manager.data.folders[0].id;
      
      // @ts-ignore
      manager.data.folderContents[folderId] = [{ conversationId: '123' } as any];
      
      await manager.deleteFolder(folderId);
      
      // @ts-ignore
      expect(manager.data.folders.length).toBe(0);
      // @ts-ignore
      expect(manager.data.folderContents[folderId]).toBeUndefined();
    });

    it('toggleFolder switches isExpanded state', async () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.createFolder('To Toggle');
      // @ts-ignore
      const folderId = manager.data.folders[0].id;
      // @ts-ignore
      expect(manager.data.folders[0].isExpanded).toBe(true);
      
      await manager.toggleFolder(folderId);
      
      // @ts-ignore
      expect(manager.data.folders[0].isExpanded).toBe(false);
    });
  });

  describe('Drag and Drop Operations', () => {
    it('handleDrop adds a notebook to a folder', async () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.createFolder('Drop Target');
      // @ts-ignore
      const folderId = manager.data.folders[0].id;
      
      const dragData = {
        type: 'conversation',
        conversationId: 'notebook-id-1',
        title: 'My Notebook',
        url: 'https://notebooklm.google.com/notebook/notebook-id-1'
      };
      
      const success = await manager.handleDrop(folderId, JSON.stringify(dragData));
      expect(success).toBe(true);
      
      // @ts-ignore
      const list = manager.data.folderContents[folderId];
      expect(list.length).toBe(1);
      expect(list[0].conversationId).toBe('notebook-id-1');
      
      // Attempting to add the same notebook again should fail
      const success2 = await manager.handleDrop(folderId, JSON.stringify(dragData));
      expect(success2).toBe(false);
    });

    it('shows toast when handleDrop fails (duplicate) in createFolderElement drop handler', async () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.init(); // Initialize toast
      await manager.createFolder('Repeat Folder');
      const folder = (manager as any).data.folders[0];
      
      const el = (manager as any).createFolderElement(folder, 0);
      
      const dragData = { type: 'conversation', conversationId: 'dup-1', title: 'Dup' };
      // First drop (success)
      await (manager as any).handleDrop(folder.id, JSON.stringify(dragData));
      
      // Simulate drop event
      const dropEvent = new CustomEvent('drop', { bubbles: true }) as any;
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer = {
        getData: vi.fn(() => JSON.stringify(dragData))
      };
      
      el.dispatchEvent(dropEvent);
      
      // Wait for async handleDrop in listener
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect((manager as any).toast.addToast).toHaveBeenCalledWith(expect.any(String), 'error', expect.any(Object));
    });

    it('removeFromFolder removes a notebook from a folder', async () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      await manager.createFolder('Source Folder');
      // @ts-ignore
      const folderId = manager.data.folders[0].id;
      
      const dragData = { type: 'conversation', conversationId: 'rm-id-1', title: 'A' };
      await manager.handleDrop(folderId, JSON.stringify(dragData));
      
      await manager.removeFromFolder(folderId, 'rm-id-1');
      
      // @ts-ignore
      const list = manager.data.folderContents[folderId];
      expect(list.length).toBe(0);
    });
    
    it('makeNotebooksDraggable attaches drag events to project-button cards', () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      const container = document.createElement('div');
      
      // Create a project-button custom element with proper structure
      const projectBtn = document.createElement('project-button');
      const titleSpan = document.createElement('span');
      titleSpan.className = 'project-button-title';
      titleSpan.id = 'project-83d27ed3-f142-4c4c-9018-29deb0c076dc-title';
      titleSpan.textContent = 'Notebook 123';
      projectBtn.appendChild(titleSpan);
      container.appendChild(projectBtn);
      
      // Add a non-matching element
      const div = document.createElement('div');
      container.appendChild(div);
      
      (manager as any).makeNotebooksDraggable(container);
      
      // The project-button should have draggable="true"
      expect(projectBtn.getAttribute('draggable')).toBe('true');
      expect(div.hasAttribute('draggable')).toBe(false);
    });
  });

  describe('Menu Action Injection', () => {
    it('checkAndInjectMenuAction adds exactly one button', () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      
      // Mock lastNotebookInfo
      (manager as any).lastNotebookInfo = {
        conversationId: 'notebook-id-1',
        title: 'Notebook 1'
      };
      
      // Setup mock menu DOM
      const menu = document.createElement('div');
      menu.className = 'mat-mdc-menu-content';
      document.body.appendChild(menu);
      
      try {
        // First injection
        (manager as any).checkAndInjectMenuAction();
        expect(menu.querySelectorAll('.gv-move-to-folder-btn').length).toBe(1);
        expect(menu.classList.contains('gv-injected')).toBe(true);
        
        // Second injection (should NOT add another button)
        (manager as any).checkAndInjectMenuAction();
        expect(menu.querySelectorAll('.gv-move-to-folder-btn').length).toBe(1);
      } finally {
        menu.remove();
      }
    });

    it('checkAndInjectMenuAction updates button when notebook changes', () => {
      const manager = new NotebookLMFolderManager();
      managers.push(manager);
      
      // Mock menu DOM
      const menu = document.createElement('div');
      menu.className = 'mat-mdc-menu-content';
      document.body.appendChild(menu);
      
      try {
        // Inject for notebook 1
        (manager as any).lastNotebookInfo = { conversationId: 'nb-1', title: 'NB 1' };
        (manager as any).checkAndInjectMenuAction();
        const btn1 = menu.querySelector('.gv-move-to-folder-btn') as HTMLElement;
        expect(btn1.dataset.notebookId).toBe('nb-1');
        
        // Inject for notebook 2 (on SAME menu element)
        (manager as any).lastNotebookInfo = { conversationId: 'nb-2', title: 'NB 2' };
        (manager as any).checkAndInjectMenuAction();
        
        const btn2 = menu.querySelector('.gv-move-to-folder-btn') as HTMLElement;
        expect(menu.querySelectorAll('.gv-move-to-folder-btn').length).toBe(1);
        expect(btn2.dataset.notebookId).toBe('nb-2');
      } finally {
        menu.remove();
      }
    });

    it('restores button if gv-injected class is present but button is gone', () => {
       const manager = new NotebookLMFolderManager();
       managers.push(manager);
       
       const menu = document.createElement('div');
       menu.className = 'mat-mdc-menu-content gv-injected'; // Already marked as injected
       document.body.appendChild(menu);
       
       (manager as any).lastNotebookInfo = { conversationId: 'nb-1', title: 'NB 1' };
       
       try {
         (manager as any).checkAndInjectMenuAction();
         expect(menu.querySelector('.gv-move-to-folder-btn')).toBeTruthy();
       } finally {
         menu.remove();
       }
    });
  });
});
