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
    // Check if chrome API is available (it might not be in some mock/web contexts, so add safe fallback)
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      console.warn('Chrome storage API not available.');
      return;
    }

    const data = await chrome.storage.local.get([
      'verifyToken',
      'resumeProfile',
      'uploadedDocuments'
    ]);
    
    set({
      isPasswordSet: !!data.verifyToken,
      resumeProfile: data.resumeProfile || null,
      uploadedDocuments: data.uploadedDocuments || []
    });
    
    // Listen for changes from other extension contexts (e.g. Popup updates key, Options page updates profile)
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
      }
    });
  },
  
  setPassword: async (password: string) => {
    // 1. Create a verification token "VERIFIED" encrypted with the password
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
      
      // Try to decrypt the verification token
      const decryptedToken = await decryptText(data.verifyToken, password);
      if (decryptedToken !== 'VERIFIED') {
        return false;
      }
      
      // Decrypt API Key if it exists
      let decryptedKey = '';
      if (data.encryptedApiKey) {
        decryptedKey = await decryptText(data.encryptedApiKey, password);
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
    set({
      apiKey: key
    });
  },
  
  resetPassword: async () => {
    await chrome.storage.local.remove([
      'verifyToken',
      'encryptedApiKey',
      'resumeProfile',
      'uploadedDocuments'
    ]);
    
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
