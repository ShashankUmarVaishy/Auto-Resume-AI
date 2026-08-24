declare const chrome: any;

import { create } from 'zustand';
import type { MasterResumeProfile, DocumentFile } from '../types';
import { encryptText, decryptText } from '../utils/crypto';

interface StoreState {
  isLocked: boolean;
  isPasswordSet: boolean;
  apiKey: string; // Plaintext in memory only
  resumeProfile: MasterResumeProfile | null;
  uploadedDocuments: DocumentFile[];
  
  // Actions
  init: () => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  saveApiKey: (key: string, password: string) => Promise<void>;
  resetPassword: () => Promise<void>;
  updateResumeProfile: (profile: MasterResumeProfile) => Promise<void>;
  addDocument: (doc: DocumentFile) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export const useResumeStore = create<StoreState>((set, get) => ({
  isLocked: true,
  isPasswordSet: false,
  apiKey: '',
  resumeProfile: null,
  uploadedDocuments: [],
  
  init: async () => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      console.warn('Chrome storage API not available.');
      return;
    }

    // Configure session storage access level so content scripts (running in untrusted host pages) can read it safely
    try {
      if (chrome.storage.session && chrome.storage.session.setAccessLevel) {
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
      }
    } catch (e) {
      // Access level can only be set from popup/options/background scripts, content scripts will throw (safely ignore)
    }

    const data = await chrome.storage.local.get([
      'verifyToken',
      'resumeProfile',
      'uploadedDocuments'
    ]);

    // Check if the decrypted API key is already unlocked in session storage
    let sessionApiKey = '';
    try {
      if (chrome.storage.session) {
        const sessionData = await chrome.storage.session.get('apiKey');
        sessionApiKey = sessionData.apiKey || '';
      }
    } catch (e) {
      // Ignore
    }

    set({
      isPasswordSet: !!data.verifyToken,
      isLocked: !sessionApiKey,
      apiKey: sessionApiKey,
      resumeProfile: data.resumeProfile || null,
      uploadedDocuments: data.uploadedDocuments || []
    });

    // Listen for changes from other contexts (e.g. Popup updates key, Options page updates profile)
    chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
      if (areaName === 'local') {
        const updates: Partial<StoreState> = {};
        if (changes.verifyToken) {
          updates.isPasswordSet = !!changes.verifyToken.newValue;
          if (!changes.verifyToken.newValue) {
            updates.isLocked = true;
            updates.apiKey = '';
          }
        }
        if (changes.resumeProfile) {
          updates.resumeProfile = changes.resumeProfile.newValue || null;
        }
        if (changes.uploadedDocuments) {
          updates.uploadedDocuments = changes.uploadedDocuments.newValue || [];
        }
        set(updates);
      } else if (areaName === 'session') {
        if (changes.apiKey) {
          const newKey = changes.apiKey.newValue || '';
          set({
            apiKey: newKey,
            isLocked: !newKey
          });
        }
      }
    });
  },

  setPassword: async (password: string) => {
    const token = await encryptText('VERIFIED', password);
    await chrome.storage.local.set({
      verifyToken: token
    });
    set({
      isPasswordSet: true,
      isLocked: false
    });
  },

  unlock: async (password: string): Promise<boolean> => {
    try {
      const data = await chrome.storage.local.get(['verifyToken', 'encryptedApiKey']);
      if (!data.verifyToken) {
        return false;
      }

      const decryptedToken = await decryptText(data.verifyToken, password);
      if (decryptedToken !== 'VERIFIED') {
        return false;
      }

      let decryptedKey = '';
      if (data.encryptedApiKey) {
        decryptedKey = await decryptText(data.encryptedApiKey, password);
      }

      // Persist decrypted key in session memory
      if (chrome.storage.session) {
        await chrome.storage.session.set({ apiKey: decryptedKey });
      }

      set({
        isLocked: false,
        apiKey: decryptedKey
      });
      return true;
    } catch (e) {
      console.error('Failed to unlock store:', e);
      return false;
    }
  },

  lock: () => {
    if (chrome.storage.session) {
      chrome.storage.session.remove('apiKey');
    }
    set({
      isLocked: true,
      apiKey: ''
    });
  },

  saveApiKey: async (key: string, password: string) => {
    const encryptedKey = await encryptText(key, password);
    await chrome.storage.local.set({
      encryptedApiKey: encryptedKey
    });
    
    // Save to session memory
    if (chrome.storage.session) {
      await chrome.storage.session.set({ apiKey: key });
    }
    
    set({
      apiKey: key,
      isLocked: false
    });
  },

  resetPassword: async () => {
    await chrome.storage.local.remove([
      'verifyToken',
      'encryptedApiKey',
      'resumeProfile',
      'uploadedDocuments'
    ]);
    
    if (chrome.storage.session) {
      await chrome.storage.session.remove('apiKey');
    }

    set({
      isPasswordSet: false,
      isLocked: true,
      apiKey: '',
      resumeProfile: null,
      uploadedDocuments: []
    });
  },
  
  updateResumeProfile: async (profile: MasterResumeProfile) => {
    await chrome.storage.local.set({
      resumeProfile: profile
    });
    set({
      resumeProfile: profile
    });
  },
  
  addDocument: async (doc: DocumentFile) => {
    const documents = [...get().uploadedDocuments, doc];
    await chrome.storage.local.set({
      uploadedDocuments: documents
    });
    set({
      uploadedDocuments: documents
    });
  },
  
  deleteDocument: async (id: string) => {
    const documents = get().uploadedDocuments.filter(d => d.id !== id);
    await chrome.storage.local.set({
      uploadedDocuments: documents
    });
    set({
      uploadedDocuments: documents
    });
  }
}));
