import React, { useState, useEffect, useRef } from 'react';
import { FieldDetector } from '../../src/utils/FieldDetector';
import type { FieldMatch } from '../../src/utils/FieldDetector';
import { setNativeValue } from '../../src/utils/injector';
import { tailorTextWithAI } from '../../src/utils/gemini';
import { useResumeStore } from '../../src/store/useResumeStore';
import { Sparkles, Clipboard, Check, ChevronLeft, ChevronRight, RefreshCw, X, Brain } from 'lucide-react';

export default function PopoverElement() {
  const store = useResumeStore();
  
  // Active element matching states
  const [activeEl, setActiveEl] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [detectedMatch, setDetectedMatch] = useState<FieldMatch | null>(null);
  
  // UI states
  const [showSpark, setShowSpark] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tailoringLoading, setTailoringLoading] = useState(false);
  
  // Project carousel states
  const [activeProjectIdx, setActiveProjectIdx] = useState(0);

  // Keep references to components to handle outside clicks
  const popoverRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLButtonElement>(null);

  // Initialize store connection in the content script
  useEffect(() => {
    store.init();
  }, []);

  // Set up listeners for page interaction
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        !(target.getAttribute('type') === 'password') &&
        !(target.getAttribute('type') === 'file')
      ) {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        
        // Match with heuristics
        const match = FieldDetector.detect(input, store.resumeProfile);
        if (match) {
          setActiveEl(input);
          setDetectedMatch(match);
          setActiveRect(input.getBoundingClientRect());
          setShowSpark(true);
          setShowPopover(false);
        } else {
          // If no match found, hide spark
          setShowSpark(false);
          setShowPopover(false);
        }
      }
    };

    const handleScrollAndResize = () => {
      if (activeEl) {
        setActiveRect(activeEl.getBoundingClientRect());
      }
    };

    // Close popover if user clicks outside our popup or the input
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Since our UI is inside a closed shadow root, target will be the shadow host
      // so we check if the path or active click was processed inside our popover
      if (showPopover && popoverRef.current && !popoverRef.current.contains(target) && target !== activeEl) {
        setShowPopover(false);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('scroll', handleScrollAndResize, true);
    window.addEventListener('resize', handleScrollAndResize);
    window.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('scroll', handleScrollAndResize, true);
      window.removeEventListener('resize', handleScrollAndResize);
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeEl, showPopover, store.resumeProfile]);

  if (!showSpark || !activeRect || !detectedMatch) return null;

  // Calculate coordinates relative to screen viewport
  const sparkTop = activeRect.top + window.scrollY + (activeRect.height - 24) / 2;
  const sparkLeft = activeRect.right + window.scrollX - 60; // Render slightly inside the right edge

  // Viewport Collision Check (approx 260px estimated popover height)
  const openAbove = activeRect.bottom + 260 > window.innerHeight;
  const popoverTop = openAbove 
    ? activeRect.top + window.scrollY - 10 
    : activeRect.bottom + window.scrollY + 6;
  const popoverLeft = activeRect.left + window.scrollX;

  // Handle direct injection
  const handleAutofill = (valueToFill: string) => {
    if (activeEl) {
      setNativeValue(activeEl, valueToFill);
      setShowPopover(false);
      setShowSpark(false);
    }
  };

  // Handle clipboard copy
  const handleCopyToClipboard = (valueToCopy: string) => {
    navigator.clipboard.writeText(valueToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  // Instant Tailoring: runs client-side Gemini or local truncation fallback
  const handleInstantTailoring = async (wordLimit: number) => {
    const projects = store.resumeProfile?.projects || [];
    if (projects.length === 0) return;
    
    const activeProject = projects[activeProjectIdx];
    if (!activeProject) return;
    const sourceText = activeProject.description;
    
    setTailoringLoading(true);
    
    try {
      if (store.apiKey) {
        // AI Tailoring
        const context = `Highlight tech stack: ${activeProject.techStack.join(', ')}`;
        const tailoredText = await tailorTextWithAI(sourceText, wordLimit, context, store.apiKey);
        handleAutofill(tailoredText);
      } else {
        // Fallback: Local Word-Limit Truncation
        const words = sourceText.split(/\s+/);
        if (words.length <= wordLimit) {
          handleAutofill(sourceText);
        } else {
          const truncated = words.slice(0, wordLimit).join(' ') + '...';
          handleAutofill(truncated);
        }
      }
    } catch (err) {
      console.error('Tailoring failed:', err);
      // Fallback on error
      const words = sourceText.split(/\s+/);
      const truncated = words.slice(0, wordLimit).join(' ') + '...';
      handleAutofill(truncated);
    } finally {
      setTailoringLoading(false);
    }
  };

  return (
    <div style={{ pointerEvents: 'auto' }}>
      {/* 1. Spark Badge next to active input */}
      {!showPopover && (
        <button
          ref={sparkRef}
          onClick={() => setShowPopover(true)}
          style={{
            position: 'absolute',
            top: `${sparkTop}px`,
            left: `${sparkLeft}px`,
            zIndex: 9999999,
          }}
          className="flex items-center space-x-1 bg-darkCard/95 hover:bg-slate-900 border border-accentCyan/30 text-accentCyan hover:text-white px-2 py-0.5 rounded shadow-lg shadow-accentCyan/10 text-[10px] font-bold cursor-pointer transition-all hover:scale-105 duration-150"
        >
          <Sparkles className="w-3 h-3 text-accentCyan animate-pulse" />
          <span>Fill</span>
        </button>
      )}

      {/* 2. Expanded Popover widget */}
      {showPopover && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: `${popoverTop}px`,
            left: `${popoverLeft}px`,
            zIndex: 9999999,
            minWidth: '280px',
            maxWidth: '360px',
          }}
          className={`bg-darkCard border border-darkBorder rounded-xl shadow-2xl p-4 text-slate-100 font-sans transition-all duration-200 ${openAbove ? '-translate-y-full' : ''}`}
        >
          {/* Popover Header */}
          <div className="flex justify-between items-center border-b border-darkBorder pb-2 mb-3">
            <div className="flex items-center space-x-1.5 text-accentCyan">
              <Brain className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{detectedMatch.label}</span>
            </div>
            <button
              onClick={() => setShowPopover(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* PROJECT SELECTOR CAROUSEL VIEW */}
          {detectedMatch.type === 'project_selector' ? (
            <div>
              {(() => {
                const projects = store.resumeProfile?.projects || [];
                const activeProject = projects[activeProjectIdx];
                if (projects.length === 0 || !activeProject) {
                  return <p className="text-xs text-slate-400 text-center py-2">No projects found. Add them in options!</p>;
                }
                return (
                  <div>
                    {/* Carousel selector */}
                    <div className="flex items-center justify-between bg-darkBg/60 p-2.5 rounded-lg border border-darkBorder mb-3">
                      <button
                        onClick={() => setActiveProjectIdx(prev => Math.max(0, prev - 1))}
                        disabled={activeProjectIdx === 0}
                        className="p-1 disabled:opacity-30 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="text-center flex-1 mx-2">
                        <span className="text-xs font-bold text-slate-200 block truncate">
                          {activeProject.name}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Project {activeProjectIdx + 1} of {projects.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveProjectIdx(prev => Math.min(projects.length - 1, prev + 1))}
                        disabled={activeProjectIdx === projects.length - 1}
                        className="p-1 disabled:opacity-30 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tech stack highlight */}
                    <div className="text-[10px] text-accentCyan mb-2 font-mono truncate">
                      Stack: {activeProject.techStack.join(', ')}
                    </div>

                    {/* Character/Word-limit tailoring buttons */}
                    <div className="border-t border-darkBorder/40 pt-2 mb-3">
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block mb-1.5">
                        Tailor description to limit:
                      </span>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <button
                          onClick={() => handleInstantTailoring(100)}
                          disabled={tailoringLoading}
                          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[10px] py-1.5 rounded cursor-pointer font-medium"
                        >
                          100 words
                        </button>
                        <button
                          onClick={() => handleInstantTailoring(250)}
                          disabled={tailoringLoading}
                          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[10px] py-1.5 rounded cursor-pointer font-medium"
                        >
                          250 words
                        </button>
                        <button
                          onClick={() => handleInstantTailoring(500)}
                          disabled={tailoringLoading}
                          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[10px] py-1.5 rounded cursor-pointer font-medium"
                        >
                          500 words
                        </button>
                      </div>
                    </div>

                    {/* Standard fill options for current project description */}
                    <div className="flex space-x-2 pt-2 border-t border-darkBorder">
                      <button
                        onClick={() => handleAutofill(activeProject.description)}
                        disabled={tailoringLoading}
                        className="flex-1 bg-accentCyan hover:bg-cyan-500 disabled:opacity-50 text-darkBg font-bold py-1.5 rounded text-xs cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        {tailoringLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                        <span>{tailoringLoading ? 'Rewriting...' : 'Autofill Raw'}</span>
                      </button>
                      <button
                        onClick={() => handleCopyToClipboard(activeProject.description)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-darkBorder rounded cursor-pointer text-slate-300"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-4 h-4 text-accentGreen" /> : <Clipboard className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* STANDARD TEXT/SELECT FIELD VIEW */
            <div>
              <p className="text-xs text-slate-300 bg-darkBg/60 border border-darkBorder p-2.5 rounded-lg mb-3 break-words max-h-32 overflow-y-auto">
                {detectedMatch.value}
              </p>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleAutofill(detectedMatch.value)}
                  className="flex-1 bg-accentCyan hover:bg-cyan-500 text-darkBg font-bold py-1.5 rounded text-xs cursor-pointer transition-colors"
                >
                  Autofill Field
                </button>
                <button
                  onClick={() => handleCopyToClipboard(detectedMatch.value)}
                  className="px-3 bg-slate-800 hover:bg-slate-700 border border-darkBorder rounded text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-accentGreen" />
                  ) : (
                    <Clipboard className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
