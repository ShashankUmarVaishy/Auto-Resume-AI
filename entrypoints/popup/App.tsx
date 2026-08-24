declare const chrome: any;

import React from 'react';

export default function App() {
  const openOptionsPage = () => {
    if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'), '_blank');
    }
  };

  return (
    <div className="w-[480px] min-h-[220px] bg-darkBg text-slate-100 p-6 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darkBorder pb-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accentCyan to-accentGreen flex items-center justify-center font-bold text-darkBg text-xl">
            A
          </div>
          <div>
            <h1 className="text-md font-bold leading-none">AutoResume AI</h1>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-1 block">ATS Application Copilot</span>
          </div>
        </div>
        <button 
          onClick={openOptionsPage}
          className="text-xs bg-darkCard hover:bg-slate-800 border border-darkBorder px-3.5 py-2 rounded-lg text-accentCyan hover:text-white transition-all cursor-pointer font-semibold shadow-lg shadow-black/20"
        >
          Options Panel
        </button>
      </div>

      {/* Main Content Info */}
      <div className="bg-darkCard border border-darkBorder rounded-xl p-4 text-center mb-4">
        <p className="text-xs text-slate-400 font-medium">Security Status</p>
        <p className="text-sm font-bold text-accentGreen mt-1 flex items-center justify-center space-x-1.5">
          <span>🔒 Password-Protected Local Storage</span>
        </p>
      </div>

      {/* Quick Stats / Actions */}
      <div className="grid grid-cols-2 gap-3 text-center text-xs">
        <div className="bg-darkCard border border-darkBorder p-4 rounded-xl">
          <p className="text-slate-400 font-medium">Active Profile</p>
          <p className="font-bold text-accentCyan mt-1 text-sm">None Loaded</p>
        </div>
        <div className="bg-darkCard border border-darkBorder p-4 rounded-xl">
          <p className="text-slate-400 font-medium">Document Library</p>
          <p className="font-bold text-accentPurple mt-1 text-sm">0 Files</p>
        </div>
      </div>
      
      {/* Footer */}
      <p className="text-[10px] text-center text-slate-500 mt-6 tracking-wide">
        AutoResume AI v1.0.0 • Local-First Security • Session-Synced Encryption
      </p>
    </div>
  );
}
