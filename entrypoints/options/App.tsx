import React, { useState, useEffect } from 'react';
import { useResumeStore } from '../../src/store/useResumeStore';
import { extractTextFromPdf, extractTextFromDocx } from '../../src/utils/parser';
import { parseResumeWithAI } from '../../src/utils/gemini';
import type { DocumentFile, MasterResumeProfile } from '../../src/types';
import { 
  Lock, Unlock, FileText, Settings, User, Plus, Trash, Check, Edit2, 
  Brain, Key, RefreshCw, AlertTriangle, HelpCircle, Save, ChevronRight,
  Download, Upload
} from 'lucide-react';

export default function App() {
  const store = useResumeStore();
  
  // Gating & Authentication States
  const [passwordInput, setPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // App navigation state
  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'snippets' | 'settings'>('profile');
  
  // Settings / API Key forms
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiSuccessMsg, setApiSuccessMsg] = useState('');
  
  // Document uploading state
  const [uploadType, setUploadType] = useState<'resume' | 'cover_letter' | 'other'>('resume');
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  
  // Edit Profile Mode states
  const [editedProfile, setEditedProfile] = useState<MasterResumeProfile | null>(null);
  const [isEditingRawJson, setIsEditingRawJson] = useState(false);
  const [jsonText, setJsonText] = useState('');

  // Sync jsonText when editedProfile changes
  useEffect(() => {
    if (editedProfile) {
      setJsonText(JSON.stringify(editedProfile, null, 2));
    } else {
      setJsonText('');
    }
  }, [editedProfile]);

  // Sync local editedProfile state when store loads it
  useEffect(() => {
    if (store.resumeProfile && !editedProfile) {
      setEditedProfile(store.resumeProfile);
    }
  }, [store.resumeProfile, editedProfile]);

  const [editingProjectIndex, setEditingProjectIndex] = useState<number | null>(null);
  const [editingWorkIndex, setEditingWorkIndex] = useState<number | null>(null);
  const [editingEduIndex, setEditingEduIndex] = useState<number | null>(null);
  
  // QA Snippet state
  const [newSnippetLabel, setNewSnippetLabel] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');

  // Initialize the store
  useEffect(() => {
    store.init();
  }, []);

  // Sync API Key input once unlocked
  useEffect(() => {
    if (!store.isLocked && store.apiKey) {
      setApiKeyInput(store.apiKey);
    }
  }, [store.isLocked, store.apiKey]);

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setAuthError('Password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthError('');
    await store.setPassword(newPassword);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const success = await store.unlock(passwordInput);
    if (!success) {
      setAuthError('Incorrect password.');
    } else {
      setPasswordInput('');
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiSuccessMsg('');
    if (!passwordInput) {
      alert('Please enter your password below to authorize saving the key.');
      return;
    }
    
    // Verify password first
    const correct = await store.unlock(passwordInput);
    if (!correct) {
      alert('Incorrect password. Cannot save key.');
      return;
    }

    await store.saveApiKey(apiKeyInput, passwordInput);
    setApiSuccessMsg('API Key saved and encrypted successfully.');
    setPasswordInput('');
  };

  // Upload file handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      let extractedText = '';
      
      try {
        if (file.name.endsWith('.pdf')) {
          extractedText = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx')) {
          extractedText = await extractTextFromDocx(file);
        } else {
          setUploadError(`Unsupported file format for ${file.name}. Only PDF and DOCX are supported.`);
          continue;
        }

        if (!extractedText.trim()) {
          setUploadError(`Could not extract text from ${file.name}. Check if the file is empty or scanned.`);
          continue;
        }

        const newDoc: DocumentFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: uploadType,
          content: extractedText,
          size: file.size,
          uploadedAt: new Date().toLocaleDateString()
        };

        await store.addDocument(newDoc);
      } catch (err) {
        console.error(err);
        setUploadError(`Failed to process ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // Clear input
    e.target.value = '';
  };

  // Run AI structured parsing on stored document text
  const handleParseDocument = async (doc: DocumentFile) => {
    if (!store.apiKey) {
      alert('Please set your Gemini API Key in the settings tab first.');
      return;
    }
    
    setParsingDocId(doc.id);
    try {
      const profile = await parseResumeWithAI(doc.content, store.apiKey);
      await store.updateResumeProfile(profile);
      alert('Resume parsed and master profile updated successfully!');
      setActiveTab('profile');
    } catch (err) {
      console.error(err);
      alert(`AI parsing failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setParsingDocId(null);
    }
  };

  // Profile Save helper
  const handleSaveProfile = () => {
    if (!editedProfile) return;
    store.updateResumeProfile(editedProfile);
    alert('Master Profile saved locally!');
  };

  // Raw JSON Save helper
  const handleSaveRawJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as MasterResumeProfile;
      if (!parsed.personalInfo || !parsed.projects || !parsed.skills) {
        throw new Error('Missing core profile objects (personalInfo, projects, or skills)');
      }
      setEditedProfile(parsed);
      store.updateResumeProfile(parsed);
      alert('Master Profile raw JSON saved locally!');
      setIsEditingRawJson(false);
    } catch (err) {
      alert(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Export Profile to local JSON file download
  const handleExportProfile = () => {
    if (!store.resumeProfile) {
      alert('No profile data available to export.');
      return;
    }
    try {
      const jsonString = JSON.stringify(store.resumeProfile, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `autoresume_profile_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to export profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Import Profile from local JSON file
  const handleImportProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') return;
        const parsed = JSON.parse(text) as MasterResumeProfile;
        
        // Simple schema validation
        if (!parsed.personalInfo || !parsed.projects || !parsed.skills) {
          throw new Error('JSON is missing core profile sections (personalInfo, projects, or skills)');
        }

        setEditedProfile(parsed);
        await store.updateResumeProfile(parsed);
        alert('Master Resume Profile imported successfully!');
      } catch (err) {
        alert(`Failed to parse/import JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Add QA Snippet
  const handleAddSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnippetLabel || !newSnippetContent) return;
    
    const profile = store.resumeProfile || {
      personalInfo: { fullName: '', firstName: '', lastName: '', email: '', phone: '', location: { city: '', state: '', country: '' }, urls: { linkedin: '', github: '', portfolio: '' }, summaryStatement: '' },
      education: [],
      workExperience: [],
      projects: [],
      skills: { languages: [], frameworks: [], toolsAndPlatforms: [], coreCompetencies: [] },
      customSnippets: []
    };

    const updatedSnippets = [...(profile.customSnippets || []), { label: newSnippetLabel, content: newSnippetContent }];
    const updatedProfile = { ...profile, customSnippets: updatedSnippets };
    
    store.updateResumeProfile(updatedProfile);
    setNewSnippetLabel('');
    setNewSnippetContent('');
  };

  const handleDeleteSnippet = (index: number) => {
    if (!store.resumeProfile) return;
    const updatedSnippets = store.resumeProfile.customSnippets.filter((_, i) => i !== index);
    store.updateResumeProfile({ ...store.resumeProfile, customSnippets: updatedSnippets });
  };

  // --- RENDERING SECURITY GATE ---
  if (!store.isPasswordSet) {
    return (
      <div className="min-h-screen bg-darkBg text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-darkCard border border-darkBorder rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-accentCyan to-accentGreen rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accentCyan/20">
              <Lock className="w-8 h-8 text-darkBg" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-accentCyan to-accentGreen bg-clip-text text-transparent">
              Setup Master Password
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              All resume data and API keys are stored on your local disk. Set a password to encrypt them securely.
            </p>
          </div>

          <form onSubmit={handleCreatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Create Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-darkBg border border-darkBorder rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accentCyan transition-colors"
                placeholder="Minimum 4 characters"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-darkBg border border-darkBorder rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accentCyan transition-colors"
                placeholder="Re-enter password"
                required
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-accentCyan to-accentGreen text-darkBg font-bold py-3 rounded-lg text-sm transition-opacity hover:opacity-90 cursor-pointer shadow-lg shadow-accentGreen/10"
            >
              Enable Encryption & Set Password
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (store.isLocked) {
    return (
      <div className="min-h-screen bg-darkBg text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-darkCard border border-darkBorder rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-accentCyan to-accentPurple rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Options Panel Locked</h1>
            <p className="text-xs text-slate-400 mt-2">
              Enter your master password to decrypt and view your credentials.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Master Password
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-darkBg border border-darkBorder rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accentCyan transition-colors"
                placeholder="Enter password"
                required
                autoFocus
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-100 hover:bg-white text-darkBg font-bold py-3 rounded-lg text-sm transition-colors cursor-pointer"
            >
              Decrypt & Unlock Panel
            </button>

            <button
              type="button"
              onClick={async () => {
                if (confirm("Resetting will wipe all stored resumes, profiles, and keys permanently! Are you sure?")) {
                  await store.resetPassword();
                }
              }}
              className="w-full text-center text-xs text-red-400 hover:underline pt-2 cursor-pointer block"
            >
              Forgot Password / Reset Storage
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD LAYOUT ---
  return (
    <div className="min-h-screen bg-darkBg text-slate-100 flex font-sans">
      {/* Sidebar navigation */}
      <aside className="w-64 border-r border-darkBorder bg-darkCard flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-6 border-b border-darkBorder flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accentCyan to-accentGreen flex items-center justify-center font-bold text-darkBg text-xl">
            A
          </div>
          <div>
            <h2 className="font-bold leading-none text-slate-100">AutoResume AI</h2>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Dashboard</span>
          </div>
        </div>

        {/* Links */}
        <nav className="flex-1 p-4 space-y-1.5">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'profile' 
                ? 'bg-slate-800 text-accentCyan' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Master Profile</span>
          </button>
          
          <button
            onClick={() => setActiveTab('documents')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'documents' 
                ? 'bg-slate-800 text-accentGreen' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Document Library</span>
          </button>

          <button
            onClick={() => setActiveTab('snippets')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'snippets' 
                ? 'bg-slate-800 text-accentPurple' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Edit2 className="w-4 h-4" />
            <span>Custom QA Snippets</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-slate-800 text-slate-100' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Security & API</span>
          </button>
        </nav>

        {/* Lock button */}
        <div className="p-4 border-t border-darkBorder">
          <button
            onClick={() => store.lock()}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 border border-darkBorder hover:border-red-500/50 hover:text-red-400 rounded-lg text-xs font-semibold bg-darkBg/50 transition-colors cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Lock Options Page</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 overflow-y-auto p-8 max-w-5xl">
        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">Master Resume Profile</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Manage the structured database of your achievements, skills, and background.
                </p>
              </div>
              
              <div className="flex items-center space-x-2.5">
                {isEditingRawJson ? (
                  <button
                    onClick={handleSaveRawJson}
                    className="bg-accentCyan hover:bg-zinc-200 text-darkBg font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer transition-colors shadow-lg"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Raw JSON</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSaveProfile}
                    disabled={!editedProfile}
                    className="bg-accentCyan hover:bg-zinc-200 disabled:opacity-50 text-darkBg font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer transition-colors shadow-lg"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                )}
                
                <button
                  onClick={() => setIsEditingRawJson(!isEditingRawJson)}
                  disabled={!editedProfile}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-darkBorder font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isEditingRawJson ? 'Visual Editor' : 'Raw JSON'}</span>
                </button>

                <button
                  onClick={handleExportProfile}
                  disabled={!store.resumeProfile}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-darkBorder font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                  title="Export Profile to JSON file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                
                <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-darkBorder font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer transition-colors" title="Import Profile from JSON file">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportProfile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {!editedProfile ? (
              <div className="bg-darkCard border border-darkBorder rounded-xl p-8 text-center text-slate-400">
                <Brain className="w-12 h-12 mx-auto text-slate-500 mb-3" />
                <h3 className="font-semibold text-slate-200">No Profile Data Found</h3>
                <p className="text-xs max-w-sm mx-auto mt-2 text-slate-400">
                  Your profile database is empty. Go to the **Document Library** tab, upload a resume, and run the parser to fill it.
                </p>
              </div>
            ) : isEditingRawJson ? (
              <div className="bg-darkCard border border-darkBorder rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-darkBorder">
                  <h3 className="text-sm font-bold text-accentCyan uppercase tracking-widest">Raw Profile JSON Editor</h3>
                </div>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  rows={20}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-accentCyan animate-pulse-once"
                  placeholder='{ "personalInfo": ... }'
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Personal Info Card */}
                <div className="bg-darkCard border border-darkBorder rounded-xl p-6">
                  <h3 className="text-sm font-bold text-accentCyan uppercase tracking-widest border-b border-darkBorder pb-2 mb-4">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editedProfile.personalInfo?.fullName || ''}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          updated.personalInfo = { ...updated.personalInfo, fullName: e.target.value };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editedProfile.personalInfo?.email || ''}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          updated.personalInfo = { ...updated.personalInfo, email: e.target.value };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={editedProfile.personalInfo?.phone || ''}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          updated.personalInfo = { ...updated.personalInfo, phone: e.target.value };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">LinkedIn URL</label>
                      <input
                        type="text"
                        value={editedProfile.personalInfo?.urls?.linkedin || ''}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          const urls = { ...(updated.personalInfo?.urls || {}), linkedin: e.target.value };
                          updated.personalInfo = { ...updated.personalInfo, urls };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">GitHub URL</label>
                      <input
                        type="text"
                        value={editedProfile.personalInfo?.urls?.github || ''}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          const urls = { ...(updated.personalInfo?.urls || {}), github: e.target.value };
                          updated.personalInfo = { ...updated.personalInfo, urls };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Portfolio Link</label>
                      <input
                        type="text"
                        value={editedProfile.personalInfo?.urls?.portfolio || ''}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          const urls = { ...(updated.personalInfo?.urls || {}), portfolio: e.target.value };
                          updated.personalInfo = { ...updated.personalInfo, urls };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Bio / Summary Statement</label>
                    <textarea
                      rows={3}
                      value={editedProfile.personalInfo?.summaryStatement || ''}
                      onChange={(e) => {
                        const updated = { ...editedProfile };
                        updated.personalInfo = { ...updated.personalInfo, summaryStatement: e.target.value };
                        setEditedProfile(updated);
                      }}
                      className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                    />
                  </div>
                </div>

                {/* Projects Card */}
                <div className="bg-darkCard border border-darkBorder rounded-xl p-6">
                  <div className="flex justify-between items-center border-b border-darkBorder pb-2 mb-4">
                    <h3 className="text-sm font-bold text-accentCyan uppercase tracking-widest">
                      Projects
                    </h3>
                    <button
                      onClick={() => {
                        const updated = { ...editedProfile };
                        updated.projects = [...(updated.projects || [])];
                        updated.projects.push({
                          id: `proj-${Date.now()}`,
                          name: 'New Project',
                          techStack: [],
                          description: '',
                          highlights: []
                        });
                        setEditedProfile(updated);
                      }}
                      className="text-xs bg-slate-800 text-accentCyan hover:bg-slate-700 px-2 py-1 rounded flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Project</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(editedProfile.projects || []).map((project, idx) => (
                      <div key={project.id} className="border border-darkBorder bg-darkBg/40 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <input
                            type="text"
                            value={project.name}
                            onChange={(e) => {
                              const updated = { ...editedProfile };
                              updated.projects = [...(updated.projects || [])];
                              if (updated.projects[idx]) {
                                updated.projects[idx] = { ...updated.projects[idx], name: e.target.value };
                                setEditedProfile(updated);
                              }
                            }}
                            className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-accentCyan text-sm font-semibold text-slate-200 outline-none w-1/2"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...editedProfile };
                              updated.projects = (updated.projects || []).filter((_, i) => i !== idx);
                              setEditedProfile(updated);
                            }}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Tech Stack (comma separated)</label>
                            <input
                              type="text"
                              value={project.techStack.join(', ')}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.projects = [...(updated.projects || [])];
                                if (updated.projects[idx]) {
                                  updated.projects[idx] = { 
                                    ...updated.projects[idx], 
                                    techStack: e.target.value.split(',').map(s => s.trim()) 
                                  };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Description</label>
                            <textarea
                              rows={3}
                              value={project.description}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.projects = [...(updated.projects || [])];
                                if (updated.projects[idx]) {
                                  updated.projects[idx] = { ...updated.projects[idx], description: e.target.value };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Work Experience Card */}
                <div className="bg-darkCard border border-darkBorder rounded-xl p-6">
                  <div className="flex justify-between items-center border-b border-darkBorder pb-2 mb-4">
                    <h3 className="text-sm font-bold text-accentCyan uppercase tracking-widest">
                      Work Experience
                    </h3>
                    <button
                      onClick={() => {
                        const updated = { ...editedProfile };
                        updated.workExperience = [...(updated.workExperience || [])];
                        updated.workExperience.push({
                          id: `work-${Date.now()}`,
                          company: 'New Company',
                          role: 'Job Title',
                          location: '',
                          startDate: '',
                          endDate: '',
                          isCurrent: false,
                          responsibilities: [],
                          shortSummary: '',
                          techStack: []
                        });
                        setEditedProfile(updated);
                      }}
                      className="text-xs bg-slate-800 text-accentCyan hover:bg-slate-700 px-2 py-1 rounded flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Experience</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(editedProfile.workExperience || []).map((work, idx) => (
                      <div key={work.id} className="border border-darkBorder bg-darkBg/40 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <input
                            type="text"
                            value={work.company}
                            placeholder="Company Name"
                            onChange={(e) => {
                              const updated = { ...editedProfile };
                              updated.workExperience = [...(updated.workExperience || [])];
                              if (updated.workExperience[idx]) {
                                updated.workExperience[idx] = { ...updated.workExperience[idx], company: e.target.value };
                                setEditedProfile(updated);
                              }
                            }}
                            className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-accentCyan text-sm font-semibold text-slate-200 outline-none w-1/2"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...editedProfile };
                              updated.workExperience = (updated.workExperience || []).filter((_, i) => i !== idx);
                              setEditedProfile(updated);
                            }}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Job Title</label>
                            <input
                              type="text"
                              value={work.role}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.workExperience = [...(updated.workExperience || [])];
                                if (updated.workExperience[idx]) {
                                  updated.workExperience[idx] = { ...updated.workExperience[idx], role: e.target.value };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Location</label>
                            <input
                              type="text"
                              placeholder="City, State / Remote"
                              value={work.location}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.workExperience = [...(updated.workExperience || [])];
                                if (updated.workExperience[idx]) {
                                  updated.workExperience[idx] = { ...updated.workExperience[idx], location: e.target.value };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Start Date</label>
                              <input
                                type="text"
                                placeholder="MM/YYYY"
                                value={work.startDate}
                                onChange={(e) => {
                                  const updated = { ...editedProfile };
                                  updated.workExperience = [...(updated.workExperience || [])];
                                  if (updated.workExperience[idx]) {
                                    updated.workExperience[idx] = { ...updated.workExperience[idx], startDate: e.target.value };
                                    setEditedProfile(updated);
                                  }
                                }}
                                className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">End Date</label>
                              <input
                                type="text"
                                placeholder="MM/YYYY or Present"
                                value={work.endDate}
                                onChange={(e) => {
                                  const updated = { ...editedProfile };
                                  updated.workExperience = [...(updated.workExperience || [])];
                                  if (updated.workExperience[idx]) {
                                    updated.workExperience[idx] = { ...updated.workExperience[idx], endDate: e.target.value };
                                    setEditedProfile(updated);
                                  }
                                }}
                                className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 pt-4">
                            <input
                              type="checkbox"
                              id={`current-${work.id}`}
                              checked={work.isCurrent}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.workExperience = [...(updated.workExperience || [])];
                                if (updated.workExperience[idx]) {
                                  updated.workExperience[idx] = { ...updated.workExperience[idx], isCurrent: e.target.checked };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="bg-darkBg border-darkBorder text-accentCyan focus:ring-0 rounded"
                            />
                            <label htmlFor={`current-${work.id}`} className="text-[10px] text-slate-400 uppercase font-semibold cursor-pointer">Current Role</label>
                          </div>
                        </div>
                        <div className="mb-2">
                          <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Short Summary</label>
                          <textarea
                            rows={2}
                            value={work.shortSummary}
                            onChange={(e) => {
                              const updated = { ...editedProfile };
                              updated.workExperience = [...(updated.workExperience || [])];
                              if (updated.workExperience[idx]) {
                                updated.workExperience[idx] = { ...updated.workExperience[idx], shortSummary: e.target.value };
                                setEditedProfile(updated);
                              }
                            }}
                            className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Key Responsibilities (One per line)</label>
                          <textarea
                            rows={4}
                            value={(work.responsibilities || []).join('\n')}
                            onChange={(e) => {
                              const updated = { ...editedProfile };
                              updated.workExperience = [...(updated.workExperience || [])];
                              if (updated.workExperience[idx]) {
                                updated.workExperience[idx] = { 
                                  ...updated.workExperience[idx], 
                                  responsibilities: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) 
                                };
                                setEditedProfile(updated);
                              }
                            }}
                            className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs font-mono text-slate-200 outline-none"
                            placeholder="Developed REST APIs using Node.js&#10;Led team of 4 engineers"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Tech Stack (comma separated)</label>
                          <input
                            type="text"
                            value={(work.techStack || []).join(', ')}
                            onChange={(e) => {
                              const updated = { ...editedProfile };
                              updated.workExperience = [...(updated.workExperience || [])];
                              if (updated.workExperience[idx]) {
                                updated.workExperience[idx] = { 
                                  ...updated.workExperience[idx], 
                                  techStack: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                };
                                setEditedProfile(updated);
                              }
                            }}
                            className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Education Card */}
                <div className="bg-darkCard border border-darkBorder rounded-xl p-6">
                  <div className="flex justify-between items-center border-b border-darkBorder pb-2 mb-4">
                    <h3 className="text-sm font-bold text-accentCyan uppercase tracking-widest">
                      Education
                    </h3>
                    <button
                      onClick={() => {
                        const updated = { ...editedProfile };
                        updated.education = [...(updated.education || [])];
                        updated.education.push({
                          institution: 'New University',
                          degree: 'Degree',
                          fieldOfStudy: 'Major',
                          gpa: '',
                          startDate: '',
                          endDate: '',
                          coursework: [],
                          honors: []
                        });
                        setEditedProfile(updated);
                      }}
                      className="text-xs bg-slate-800 text-accentCyan hover:bg-slate-700 px-2 py-1 rounded flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Education</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(editedProfile.education || []).map((edu, idx) => (
                      <div key={idx} className="border border-darkBorder bg-darkBg/40 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <input
                            type="text"
                            value={edu.institution}
                            placeholder="Institution"
                            onChange={(e) => {
                              const updated = { ...editedProfile };
                              updated.education = [...(updated.education || [])];
                              if (updated.education[idx]) {
                                updated.education[idx] = { ...updated.education[idx], institution: e.target.value };
                                setEditedProfile(updated);
                              }
                            }}
                            className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-accentCyan text-sm font-semibold text-slate-200 outline-none w-1/2"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...editedProfile };
                              updated.education = (updated.education || []).filter((_, i) => i !== idx);
                              setEditedProfile(updated);
                            }}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Degree</label>
                            <input
                              type="text"
                              value={edu.degree}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.education = [...(updated.education || [])];
                                if (updated.education[idx]) {
                                  updated.education[idx] = { ...updated.education[idx], degree: e.target.value };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Field of Study</label>
                            <input
                              type="text"
                              value={edu.fieldOfStudy}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.education = [...(updated.education || [])];
                                if (updated.education[idx]) {
                                  updated.education[idx] = { ...updated.education[idx], fieldOfStudy: e.target.value };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">GPA</label>
                            <input
                              type="text"
                              value={edu.gpa}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.education = [...(updated.education || [])];
                                if (updated.education[idx]) {
                                  updated.education[idx] = { ...updated.education[idx], gpa: e.target.value };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Start Date (Year)</label>
                              <input
                                type="text"
                                placeholder="YYYY"
                                value={edu.startDate}
                                onChange={(e) => {
                                  const updated = { ...editedProfile };
                                  updated.education = [...(updated.education || [])];
                                  if (updated.education[idx]) {
                                    updated.education[idx] = { ...updated.education[idx], startDate: e.target.value };
                                    setEditedProfile(updated);
                                  }
                                }}
                                className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">End Date (Year)</label>
                              <input
                                type="text"
                                placeholder="YYYY"
                                value={edu.endDate}
                                onChange={(e) => {
                                  const updated = { ...editedProfile };
                                  updated.education = [...(updated.education || [])];
                                  if (updated.education[idx]) {
                                    updated.education[idx] = { ...updated.education[idx], endDate: e.target.value };
                                    setEditedProfile(updated);
                                  }
                                }}
                                className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                              />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Relevant Coursework (comma separated)</label>
                            <input
                              type="text"
                              value={(edu.coursework || []).join(', ')}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.education = [...(updated.education || [])];
                                if (updated.education[idx]) {
                                  updated.education[idx] = { 
                                    ...updated.education[idx], 
                                    coursework: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                  };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Honors & Awards (comma separated)</label>
                            <input
                              type="text"
                              value={(edu.honors || []).join(', ')}
                              onChange={(e) => {
                                const updated = { ...editedProfile };
                                updated.education = [...(updated.education || [])];
                                if (updated.education[idx]) {
                                  updated.education[idx] = { 
                                    ...updated.education[idx], 
                                    honors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                  };
                                  setEditedProfile(updated);
                                }
                              }}
                              className="w-full bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills Card */}
                <div className="bg-darkCard border border-darkBorder rounded-xl p-6">
                  <h3 className="text-sm font-bold text-accentCyan uppercase tracking-widest border-b border-darkBorder pb-2 mb-4">
                    Skills Directory
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Languages (e.g. Java, Python)</label>
                      <input
                        type="text"
                        value={(editedProfile.skills?.languages || []).join(', ')}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          updated.skills = {
                            ...(updated.skills || { frameworks: [], toolsAndPlatforms: [], coreCompetencies: [] }),
                            languages: e.target.value.split(',').map(s => s.trim())
                          };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Frameworks & Libraries</label>
                      <input
                        type="text"
                        value={(editedProfile.skills?.frameworks || []).join(', ')}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          updated.skills = {
                            ...(updated.skills || { languages: [], toolsAndPlatforms: [], coreCompetencies: [] }),
                            frameworks: e.target.value.split(',').map(s => s.trim())
                          };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Tools & Platforms</label>
                      <input
                        type="text"
                        value={(editedProfile.skills?.toolsAndPlatforms || []).join(', ')}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          updated.skills = {
                            ...(updated.skills || { languages: [], frameworks: [], coreCompetencies: [] }),
                            toolsAndPlatforms: e.target.value.split(',').map(s => s.trim())
                          };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Core Competencies</label>
                      <input
                        type="text"
                        value={(editedProfile.skills?.coreCompetencies || []).join(', ')}
                        onChange={(e) => {
                          const updated = { ...editedProfile };
                          updated.skills = {
                            ...(updated.skills || { languages: [], frameworks: [], toolsAndPlatforms: [] }),
                            coreCompetencies: e.target.value.split(',').map(s => s.trim())
                          };
                          setEditedProfile(updated);
                        }}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DOCUMENT LIBRARY TAB */}
        {activeTab === 'documents' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Document Library</h1>
              <p className="text-xs text-slate-400 mt-1">
                Upload multiple resume versions, transcripts, or cover letters to manage and parse them.
              </p>
            </div>

            {/* Upload Area */}
            <div className="bg-darkCard border border-darkBorder rounded-xl p-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Document Category</label>
                  <select
                    value={uploadType}
                    onChange={(e: any) => setUploadType(e.target.value)}
                    className="bg-darkBg border border-darkBorder text-xs rounded-lg px-3 py-2 outline-none focus:border-accentGreen"
                  >
                    <option value="resume">📄 Resume / CV</option>
                    <option value="cover_letter">✉️ Cover Letter</option>
                    <option value="other">📎 Other Reference</option>
                  </select>
                </div>
                
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Select Files (.pdf / .docx)</label>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    multiple
                    onChange={handleFileUpload}
                    className="text-xs text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-100 hover:file:bg-slate-700 cursor-pointer w-full"
                  />
                </div>
              </div>

              {uploadError && (
                <div className="mt-3 p-3 bg-red-950/40 border border-red-500/20 rounded-lg text-xs text-red-400">
                  {uploadError}
                </div>
              )}
            </div>

            {/* List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uploaded Files</h3>
              {store.uploadedDocuments.length === 0 ? (
                <div className="border border-dashed border-darkBorder bg-darkCard/20 p-8 rounded-xl text-center text-slate-500 text-xs">
                  No documents uploaded yet. Upload a PDF or DOCX resume to start.
                </div>
              ) : (
                store.uploadedDocuments.map((doc) => (
                  <div key={doc.id} className="bg-darkCard border border-darkBorder rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-slate-800 rounded-lg text-accentGreen">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-200">{doc.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Category: <span className="text-accentGreen font-semibold uppercase">{doc.type}</span> • Uploaded: {doc.uploadedAt} • Size: {(doc.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {doc.type === 'resume' && (
                        <button
                          onClick={() => handleParseDocument(doc)}
                          disabled={!!parsingDocId}
                          className="bg-accentGreen hover:bg-emerald-500 disabled:opacity-50 text-darkBg font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                        >
                          {parsingDocId === doc.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Brain className="w-3 h-3" />
                          )}
                          <span>{parsingDocId === doc.id ? 'Parsing...' : 'Extract to Master Profile'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => store.deleteDocument(doc.id)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 hover:text-red-400 border border-darkBorder rounded-lg transition-colors cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CUSTOM QA SNIPPETS TAB */}
        {activeTab === 'snippets' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Custom QA Snippets</h1>
              <p className="text-xs text-slate-400 mt-1">
                Save snippets for repetitive, open-ended question responses (e.g. "Notice Period", "Sponsorship Requirements").
              </p>
            </div>

            {/* Add Snippet Form */}
            <div className="bg-darkCard border border-darkBorder rounded-xl p-6 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accentPurple mb-3">Add QA Snippet</h3>
              <form onSubmit={handleAddSnippet} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Snippet Label / Question Name</label>
                  <input
                    type="text"
                    value={newSnippetLabel}
                    onChange={(e) => setNewSnippetLabel(e.target.value)}
                    placeholder="e.g. notice_period, sponsorship_status, relocation_preference"
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-accentPurple"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Snippet Content / Answer Text</label>
                  <textarea
                    rows={3}
                    value={newSnippetContent}
                    onChange={(e) => setNewSnippetContent(e.target.value)}
                    placeholder="Enter the detailed description text here..."
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-accentPurple"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="bg-accentPurple hover:bg-violet-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1 cursor-pointer transition-colors shadow-lg shadow-accentPurple/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Snippet</span>
                </button>
              </form>
            </div>

            {/* List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved Snippets</h3>
              {(!store.resumeProfile || !store.resumeProfile.customSnippets || store.resumeProfile.customSnippets.length === 0) ? (
                <div className="bg-darkCard/30 border border-darkBorder p-8 rounded-xl text-center text-slate-500 text-xs">
                  No snippets created yet.
                </div>
              ) : (
                store.resumeProfile.customSnippets.map((snip, index) => (
                  <div key={index} className="bg-darkCard border border-darkBorder rounded-xl p-4">
                    <div className="flex justify-between items-center border-b border-darkBorder pb-2 mb-2">
                      <span className="text-xs font-bold text-accentPurple">{snip.label}</span>
                      <button
                        onClick={() => handleDeleteSnippet(index)}
                        className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{snip.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Security & API Configuration</h1>
              <p className="text-xs text-slate-400 mt-1">
                Configure your local encryption password, verify your Gemini API key, or clear all storage.
              </p>
            </div>

            {/* API Key Form */}
            <div className="bg-darkCard border border-darkBorder rounded-xl p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4 border-b border-darkBorder pb-3">
                <div className="p-2 bg-slate-800 rounded-lg text-accentCyan">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Gemini API Key</h3>
                  <p className="text-[10px] text-slate-400">Required for Resume Parsing & AI Word-Limit Tailoring</p>
                </div>
              </div>

              <form onSubmit={handleSaveApiKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={store.apiKey ? '••••••••••••••••••••••••••••••••' : 'Enter Gemini API Key'}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Your key is encrypted on your hard drive using your Master Password. We never send it to any external telemetry server.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Re-Enter Master Password (to authorize key update)
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password to encrypt and save API key"
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-accentCyan"
                    required
                  />
                </div>

                {apiSuccessMsg && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-lg text-xs text-accentGreen">
                    {apiSuccessMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="bg-accentCyan hover:bg-cyan-500 text-darkBg font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors shadow-lg shadow-accentCyan/15"
                >
                  Encrypt & Save API Key
                </button>
              </form>
            </div>

            {/* Wipe Options */}
            <div className="bg-darkCard border border-red-500/20 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-red-950/40 border border-red-500/30 rounded-lg text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-400">Danger Zone</h3>
                  <p className="text-[10px] text-slate-400">Destructive options that delete data permanently</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Resetting your password will erase all encrypted files, extracted details, and stored keys. This cannot be undone.
              </p>

              <button
                onClick={async () => {
                  if (confirm("This will permanently delete your master password, all resumes, profiles, and credentials. Are you absolutely sure?")) {
                    await store.resetPassword();
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
              >
                Permanently Wipe Extension Storage
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
