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
    <div className="w-[360px] bg-darkBg text-slate-100 p-4 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darkBorder pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accentCyan to-accentGreen flex items-center justify-center font-bold text-darkBg text-lg">
            A
          </div>
          <div>
            <h1 className="text-md font-bold leading-none">AutoResume AI</h1>
            <span className="text-[10px] text-slate-400">ATS Copilot</span>
          </div>
        </div>
        <button 
          onClick={openOptionsPage}
          className="text-xs bg-darkCard hover:bg-slate-800 border border-darkBorder px-2.5 py-1 rounded-md text-accentCyan transition-colors cursor-pointer"
        >
          Options Panel
        </button>
      </div>

      {/* Main Content Info */}
      <div className="bg-darkCard border border-darkBorder rounded-lg p-3 text-center mb-3">
        <p className="text-xs text-slate-400">Lock Status</p>
        <p className="text-sm font-semibold text-accentGreen mt-0.5">🔒 Securely Encrypted</p>
      </div>

      {/* Quick Stats / Actions */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="bg-darkCard border border-darkBorder p-2.5 rounded-lg">
          <p className="text-slate-400">Active Profile</p>
          <p className="font-bold text-accentCyan mt-0.5">None Loaded</p>
        </div>
        <div className="bg-darkCard border border-darkBorder p-2.5 rounded-lg">
          <p className="text-slate-400">Documents</p>
          <p className="font-bold text-accentPurple mt-0.5">0 Files</p>
        </div>
      </div>
      
      {/* Footer */}
      <p className="text-[10px] text-center text-slate-500 mt-4">
        AutoResume AI v1.0.0 • Local-First Security
      </p>
    </div>
  );
}
