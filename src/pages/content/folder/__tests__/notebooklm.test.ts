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
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  const dummyMain = document.getElementById('dummy-main');
  if (dummyMain) dummyMain.remove();
});

describe('NotebookLMFolderManager', () => {
  describe('Initialization and Storage Isolation', () => {
    it('initializes only on notebooklm.google.com', async () => {
      // Test NotebookLM host
      const manager1 = new NotebookLMFolderManager();
      await manager1.init();
      expect(chrome.storage.local.get).toHaveBeenCalledWith(StorageKeys.FOLDER_DATA_NOTEBOOKLM);

      vi.clearAllMocks();

      // Test Gemini host
      Object.defineProperty(window, 'location', { value: { hostname: 'gemini.google.com' } });
      const manager2 = new NotebookLMFolderManager();
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
      await manager.init();
      
      await manager.save();
      // It should have reset to default
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [StorageKeys.FOLDER_DATA_NOTEBOOKLM]: { folders: [], folderContents: {} },
      });
    });
  });

  describe('DOM Integration Methods', () => {
    it('waitForNotebookList observes the DOM and resolves when container found', async () => {
      const manager = new NotebookLMFolderManager();
      
      const promise = manager.waitForNotebookList(100);
      
      const dummyObj = document.createElement('div');
      dummyObj.className = 'project-grid-container';
      document.body.appendChild(dummyObj);
      
      const el = await promise;
      expect(el).toBeTruthy();
      
      dummyObj.remove();
    });

    it('extractNotebookId correctly extracts ID from element attributes', () => {
      const manager = new NotebookLMFolderManager();
      
      // Strategy 1: child element with project-{uuid}-title id
      const el = document.createElement('div');
      const titleSpan = document.createElement('span');
      titleSpan.id = 'project-83d27ed3-f142-4c4c-9018-29deb0c076dc-title';
      el.appendChild(titleSpan);
      expect(manager.extractNotebookId(el)).toBe('83d27ed3-f142-4c4c-9018-29deb0c076dc');

      // Strategy 2: aria-labelledby referencing project id
      const el2 = document.createElement('button');
      el2.setAttribute('aria-labelledby', 'project-afd2f0cf-4553-4f6a-8609-761aa55dbc05-title project-afd2f0cf-4553-4f6a-8609-761aa55dbc05-emoji');
      expect(manager.extractNotebookId(el2)).toBe('afd2f0cf-4553-4f6a-8609-761aa55dbc05');

      // No ID present
      const el3 = document.createElement('div');
      expect(manager.extractNotebookId(el3)).toBeNull();
    });

    it('injectFolderUI creates header and title', () => {
      const manager = new NotebookLMFolderManager();
      // Initialize internal translator mock manually for the test
      (manager as any).t = (k: string) => k;
      
      const target = document.createElement('div');
      document.body.appendChild(target);
      
      manager.injectFolderUI(target);
      
      const container = document.querySelector('.gv-notebooklm-folder-container');
      expect(container).toBeTruthy();
      expect(container?.querySelector('.gv-notebooklm-folder-title')?.textContent).toContain('folderTitle');
      
      container?.remove();
      target.remove();
    });
  });

  describe('Folder CRUD Operations', () => {
    it('createFolder adds a folder', async () => {
      const manager = new NotebookLMFolderManager();
      const folder = await manager.createFolder('My Folder');
      
      expect(folder).toBeTruthy();
      expect(folder?.name).toBe('My Folder');
      // @ts-ignore - accessing private data for test
      expect(manager.data.folders.length).toBe(1);
      // @ts-ignore
      expect(manager.data.folderContents[folder!.id]).toEqual([]);
    });

    it('renameFolder renames an existing folder', async () => {
      const manager = new NotebookLMFolderManager();
      const folder = await manager.createFolder('Old Name');
      
      const success = await manager.renameFolder(folder!.id, 'New Name');
      expect(success).toBe(true);
      
      // @ts-ignore
      const renamed = manager.data.folders[0];
      expect(renamed.name).toBe('New Name');
      
      // Renaming to empty string or same string should fail
      const fail1 = await manager.renameFolder(folder!.id, '   ');
      expect(fail1).toBe(false);
      
      const fail2 = await manager.renameFolder(folder!.id, 'New Name');
      expect(fail2).toBe(false);
    });

    it('deleteFolder deletes a folder and its contents reference', async () => {
      const manager = new NotebookLMFolderManager();
      const folder = await manager.createFolder('To Delete');
      
      // @ts-ignore
      manager.data.folderContents[folder!.id] = [{ conversationId: '123' } as any];
      
      const success = await manager.deleteFolder(folder!.id);
      expect(success).toBe(true);
      
      // @ts-ignore
      expect(manager.data.folders.length).toBe(0);
      // @ts-ignore
      expect(manager.data.folderContents[folder!.id]).toBeUndefined();
    });

    it('toggleFolder switches isExpanded state', async () => {
      const manager = new NotebookLMFolderManager();
      const folder = await manager.createFolder('To Toggle');
      expect(folder?.isExpanded).toBe(true);
      
      await manager.toggleFolder(folder!.id);
      
      // @ts-ignore
      expect(manager.data.folders[0].isExpanded).toBe(false);
    });
  });

  describe('Drag and Drop Operations', () => {
    it('handleDrop adds a notebook to a folder', async () => {
      const manager = new NotebookLMFolderManager();
      const folder = await manager.createFolder('Drop Target');
      
      const dragData = {
        type: 'conversation',
        conversationId: 'notebook-id-1',
        title: 'My Notebook',
        url: 'https://notebooklm.google.com/notebook/notebook-id-1'
      };
      
      const success = await manager.handleDrop(folder!.id, JSON.stringify(dragData));
      expect(success).toBe(true);
      
      // @ts-ignore
      const list = manager.data.folderContents[folder!.id];
      expect(list.length).toBe(1);
      expect(list[0].conversationId).toBe('notebook-id-1');
      expect(list[0].title).toBe('My Notebook');
      
      // Attempting to add the same notebook again should fail
      const success2 = await manager.handleDrop(folder!.id, JSON.stringify(dragData));
      expect(success2).toBe(false);
      expect(list.length).toBe(1);
      
      // Invalid drag data should fail gracefully
      const badData = { type: 'invalid' };
      const success3 = await manager.handleDrop(folder!.id, JSON.stringify(badData));
      expect(success3).toBe(false);
    });

    it('removeFromFolder removes a notebook from a folder', async () => {
      const manager = new NotebookLMFolderManager();
      const folder = await manager.createFolder('Source Folder');
      
      const dragData = { type: 'conversation', conversationId: 'rm-id-1', title: 'A' };
      await manager.handleDrop(folder!.id, JSON.stringify(dragData));
      
      const success = await manager.removeFromFolder(folder!.id, 'rm-id-1');
      expect(success).toBe(true);
      
      // @ts-ignore
      const list = manager.data.folderContents[folder!.id];
      expect(list.length).toBe(0);
      
      // removing non-existent notebook fails
      const success2 = await manager.removeFromFolder(folder!.id, 'non-existent');
      expect(success2).toBe(false);
    });
    
    it('makeNotebooksDraggable attaches drag events to project-button cards', () => {
      const manager = new NotebookLMFolderManager();
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
      
      manager.makeNotebooksDraggable(container);
      
      // The project-button should have draggable="true"
      expect(projectBtn.getAttribute('draggable')).toBe('true');
      expect(div.hasAttribute('draggable')).toBe(false);
    });
  });
});
