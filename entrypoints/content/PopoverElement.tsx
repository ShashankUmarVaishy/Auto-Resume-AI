declare const chrome: any;

import React, { useState, useEffect, useRef } from 'react';
import { FieldDetector } from '../../src/utils/FieldDetector';
import type { FieldMatch } from '../../src/utils/FieldDetector';
import { setNativeValue } from '../../src/utils/injector';
import { tailorTextWithAI } from '../../src/utils/gemini';
import { useResumeStore } from '../../src/store/useResumeStore';
import { getSemanticScore } from '../../src/utils/vectorMath';
import { Sparkles, Clipboard, Check, ChevronLeft, ChevronRight, RefreshCw, X, Brain } from 'lucide-react';

import { runSemanticSearch, getProfileValueByKey } from '../../src/utils/SemanticSearch';

export default function PopoverElement() {
  const store = useResumeStore();
  
  // Active element matching states
  const [activeEl, setActiveEl] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [detectedMatches, setDetectedMatches] = useState<FieldMatch[]>([]);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  
  // Active selected match helper
  const activeMatch = detectedMatches[activeMatchIdx] || null;
  
  // UI states
  const [showSpark, setShowSpark] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tailoringLoading, setTailoringLoading] = useState(false);
  const [showManualSelect, setShowManualSelect] = useState(false);
  
  // Draggable coordinates
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Project & Experience carousel states
  const [carouselTab, setCarouselTab] = useState<'projects' | 'experience'>('projects');
  const [activeProjectIdx, setActiveProjectIdx] = useState(0);
  const [activeExperienceIdx, setActiveExperienceIdx] = useState(0);

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
        setActiveEl(input);
        setActiveRect(input.getBoundingClientRect());
        setDragPosition(null);
        
        const labelText = FieldDetector.getAssociatedLabelText(input);
        
        // Execute synchronous offline semantic search
        const matches = runSemanticSearch(labelText, store.resumeProfile, store.learnedMappings);
        
        const mappedMatches: FieldMatch[] = matches.map(m => {
          let matchType: 'text' | 'project_selector' | 'experience_selector' = 'text';
          
          if (m.fieldKey.startsWith('projects.')) {
            matchType = 'project_selector';
          } else if (m.fieldKey.startsWith('workExperience.')) {
            matchType = 'experience_selector';
          }
          
          const val = getProfileValueByKey(store.resumeProfile, m.fieldKey);
          const labelParts = m.fieldKey.split('.');
          const rawLabel = labelParts[labelParts.length - 1] || 'Autofill Field';
          const cleanLabel = rawLabel.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          
          return {
            type: matchType,
            fieldKey: m.fieldKey,
            value: val,
            label: cleanLabel
          };
        });
        
        if (mappedMatches.length > 0) {
          setDetectedMatches(mappedMatches);
          setActiveMatchIdx(0);
          
          // Pre-select carousel active indexes if needed
          const first = mappedMatches[0];
          if (first && first.type === 'project_selector') {
            const idxMatch = first.fieldKey.match(/^projects\.(\d+)/);
            if (idxMatch) {
              setActiveProjectIdx(parseInt(idxMatch[1] || '0', 10));
            }
          } else if (first && first.type === 'experience_selector') {
            const idxMatch = first.fieldKey.match(/^workExperience\.(\d+)/);
            if (idxMatch) {
              setActiveExperienceIdx(parseInt(idxMatch[1] || '0', 10));
            }
          }
        } else {
          // If no strong semantic match, fall back to safe generic types
          const isTextArea = input.tagName.toLowerCase() === 'textarea';
          const lowerLabel = labelText.toLowerCase();
          
          let fallbackMatch: FieldMatch;
          if (isTextArea) {
            let matchType: 'textarea' | 'project_selector' | 'experience_selector' = 'textarea';
            if (lowerLabel.includes('project') || lowerLabel.includes('portfolio') || lowerLabel.includes('accomplish')) {
              matchType = 'project_selector';
            } else if (lowerLabel.includes('work') || lowerLabel.includes('job') || lowerLabel.includes('experience') || lowerLabel.includes('employ')) {
              matchType = 'experience_selector';
            }
            fallbackMatch = {
              type: matchType,
              fieldKey: 'generic_textarea',
              label: 'Textarea Field',
              value: ''
            };
          } else {
            fallbackMatch = {
              type: 'text',
              fieldKey: 'generic',
              label: 'Autofill Field',
              value: ''
            };
          }
          setDetectedMatches([fallbackMatch]);
          setActiveMatchIdx(0);
        }
        setShowSpark(true);
        setShowPopover(false);
        setShowManualSelect(false);
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
      
      // Since our UI is inside a closed shadow root, any click inside it is retargeted to the shadow host.
      if (target && target.id === 'autoresume-host') {
        return;
      }
      
      if (showPopover && popoverRef.current && !popoverRef.current.contains(target) && target !== activeEl) {
        setShowPopover(false);
        setShowManualSelect(false);
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
  }, [activeEl, showPopover, store.resumeProfile, store.learnedMappings]);

  // Mouse Dragging Handlers for Movable Popover Window
  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    const rect = popoverRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!showSpark || !activeRect || !activeMatch) return null;

  // Calculate coordinates relative to screen viewport (using position: fixed for scroll resilience)
  const sparkTop = activeRect.top + (activeRect.height - 24) / 2;
  const sparkLeft = activeRect.right - 60; // Render slightly inside the right edge

  // Viewport Collision Check (approx 320px estimated popover height with manual selector list)
  const openAbove = activeRect.bottom + 320 > window.innerHeight;
  const popoverTop = openAbove 
    ? activeRect.top - 10 
    : activeRect.bottom + 6;
  const popoverLeft = activeRect.left;

  // Handle direct injection
  const handleAutofill = (valueToFill: string, chosenFieldKey?: string) => {
    if (activeEl) {
      setNativeValue(activeEl, valueToFill);
      setShowPopover(false);
      setShowSpark(false);
      
      // If we autofilled a corrected matching key, learn the association!
      if (chosenFieldKey) {
        const defaultMatchKey = detectedMatches[0]?.fieldKey;
        // Only save mapping if the user actively corrected or changed from the default recommendation
        if (chosenFieldKey !== defaultMatchKey || activeMatchIdx > 0 || showManualSelect) {
          const labelText = FieldDetector.getAssociatedLabelText(activeEl);
          if (labelText) {
            store.addLearnedMapping(labelText, chosenFieldKey);
          }
        }
      }
    }
  };

  // Handle options page opening
  const handleOpenOptions = () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (e) {
      window.open(chrome.runtime.getURL('options.html'), '_blank');
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
    let sourceText = '';
    let context = '';

    if (activeMatch?.type === 'project_selector') {
      const projects = store.resumeProfile?.projects || [];
      if (projects.length === 0) return;
      const activeProject = projects[activeProjectIdx];
      if (!activeProject) return;
      sourceText = `${activeProject.description || ''}\n${(activeProject.highlights || []).map(h => `- ${h}`).join('\n')}`.trim();
      context = `Highlight tech stack: ${activeProject.techStack.join(', ')}`;
    } else {
      const experienceList = store.resumeProfile?.workExperience || [];
      if (experienceList.length === 0) return;
      const activeExperience = experienceList[activeExperienceIdx];
      if (!activeExperience) return;
      sourceText = `${activeExperience.shortSummary || ''}\n${(activeExperience.responsibilities || []).map(r => `- ${r}`).join('\n')}`.trim();
      context = `Role: ${activeExperience.role} at ${activeExperience.company}. Highlight tech stack: ${(activeExperience.techStack || []).join(', ')}`;
    }

    if (!sourceText) return;
    setTailoringLoading(true);
    
    try {
      if (store.apiKey) {
        // AI Tailoring
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

  // Draggable top/left offsets
  const finalTop = dragPosition ? `${dragPosition.y}px` : `${popoverTop}px`;
  const finalLeft = dragPosition ? `${dragPosition.x}px` : `${popoverLeft}px`;
  const translationClass = (openAbove && !dragPosition) ? '-translate-y-full' : '';

  return (
    <div style={{ pointerEvents: 'auto' }}>
      {/* 1. Spark Badge next to active input */}
      {!showPopover && (
        <button
          ref={sparkRef}
          onClick={() => setShowPopover(true)}
          style={{
            position: 'fixed',
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
            position: 'fixed',
            top: finalTop,
            left: finalLeft,
            zIndex: 9999999,
            minWidth: '280px',
            maxWidth: '360px',
          }}
          className={`bg-darkCard border border-darkBorder rounded-xl shadow-2xl p-4 text-slate-100 font-sans transition-all duration-200 ${translationClass}`}
        >
          {/* Popover Header (Draggable) */}
          <div 
            onMouseDown={handleDragStart}
            className="flex justify-between items-center border-b border-darkBorder pb-2 mb-2.5 cursor-move select-none"
            title="Drag to move panel"
          >
            <div className="flex items-center space-x-1.5 text-accentCyan">
              <span className="text-slate-500 font-mono text-[10px] mr-1">⋮⋮</span>
              <Brain className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{activeMatch.label}</span>
            </div>
            <button
              onClick={() => setShowPopover(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
              onMouseDown={(e) => e.stopPropagation()} // Prevent dragging from close button click
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Suggestions Quick Tabs */}
          {!showManualSelect && detectedMatches.length > 1 && (
            <div className="flex space-x-1 p-1 bg-slate-900 rounded-lg border border-darkBorder/40 mb-3 overflow-x-auto select-none">
              {detectedMatches.map((m, idx) => (
                <button
                  key={m.fieldKey + idx}
                  onClick={() => {
                    setActiveMatchIdx(idx);
                    if (m.type === 'project_selector') {
                      const idxMatch = m.fieldKey.match(/^projects\.(\d+)/);
                      if (idxMatch) setActiveProjectIdx(parseInt(idxMatch[1] || '0', 10));
                    } else if (m.type === 'experience_selector') {
                      const idxMatch = m.fieldKey.match(/^workExperience\.(\d+)/);
                      if (idxMatch) setActiveExperienceIdx(parseInt(idxMatch[1] || '0', 10));
                    }
                  }}
                  className={`flex-1 text-[9px] font-bold py-1 px-2 rounded truncate transition-all cursor-pointer text-center min-w-[70px] ${
                    idx === activeMatchIdx
                      ? 'bg-accentCyan text-darkBg shadow shadow-accentCyan/15'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* PROJECT SELECTOR / MANUAL SELECTOR / STANDARD FIELD VIEW */}
          {showManualSelect ? (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              <div className="flex justify-between items-center border-b border-darkBorder pb-1.5 mb-2">
                <span className="text-[10px] uppercase font-bold text-accentCyan">Available Profile Fields</span>
                <button 
                  onClick={() => setShowManualSelect(false)} 
                  className="text-[9px] text-slate-400 hover:text-white cursor-pointer"
                >
                  ← Back
                </button>
              </div>

              {/* Personal details list */}
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-semibold block">Personal Info</span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.firstName || '', 'personalInfo.firstName'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer"
                  >
                    First Name
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.lastName || '', 'personalInfo.lastName'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer"
                  >
                    Last Name
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.fullName || '', 'personalInfo.fullName'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 col-span-2 cursor-pointer"
                  >
                    Full Name
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.email || '', 'personalInfo.email'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 col-span-2 cursor-pointer"
                  >
                    Email
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.phone || '', 'personalInfo.phone'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 col-span-2 cursor-pointer"
                  >
                    Phone
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.urls?.linkedin || '', 'personalInfo.urls.linkedin'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer"
                  >
                    LinkedIn
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.urls?.github || '', 'personalInfo.urls.github'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer"
                  >
                    GitHub
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.urls?.portfolio || '', 'personalInfo.urls.portfolio'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer"
                  >
                    Portfolio
                  </button>
                  <button
                    onClick={() => { handleAutofill(store.resumeProfile?.personalInfo?.summaryStatement || '', 'personalInfo.summaryStatement'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer col-span-2"
                  >
                    Bio / Summary
                  </button>
                </div>
              </div>

              {/* Skills list */}
              <div className="space-y-1 pt-1.5 border-t border-darkBorder/40">
                <span className="text-[9px] text-slate-500 uppercase font-semibold block">Skills</span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <button
                    onClick={() => { handleAutofill((store.resumeProfile?.skills?.languages || []).join(', '), 'skills.languages'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer"
                  >
                    Languages
                  </button>
                  <button
                    onClick={() => { handleAutofill((store.resumeProfile?.skills?.frameworks || []).join(', '), 'skills.frameworks'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 cursor-pointer"
                  >
                    Frameworks
                  </button>
                  <button
                    onClick={() => { handleAutofill((store.resumeProfile?.skills?.toolsAndPlatforms || []).join(', '), 'skills.toolsAndPlatforms'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 col-span-2 cursor-pointer"
                  >
                    Tools & Platforms
                  </button>
                  <button
                    onClick={() => { handleAutofill((store.resumeProfile?.skills?.coreCompetencies || []).join(', '), 'skills.coreCompetencies'); setShowManualSelect(false); }}
                    className="text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 col-span-2 cursor-pointer"
                  >
                    Core Competencies
                  </button>
                </div>
              </div>

              {/* Custom QA snippets */}
              {store.resumeProfile?.customSnippets && store.resumeProfile.customSnippets.length > 0 && (
                <div className="space-y-1 pt-1.5 border-t border-darkBorder/40">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold block">QA Snippets</span>
                  <div className="space-y-1 text-[10px]">
                    {store.resumeProfile.customSnippets.map((snip, idx) => (
                      <button
                        key={idx}
                        onClick={() => { handleAutofill(snip.content, `customSnippets.${idx}`); setShowManualSelect(false); }}
                        className="w-full text-left bg-slate-800 hover:bg-slate-700 p-1.5 rounded truncate text-slate-200 block cursor-pointer"
                      >
                        {snip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Experience Manual Fields */}
              {store.resumeProfile?.workExperience && store.resumeProfile.workExperience.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-darkBorder/40">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold block">Work Experience</span>
                  <div className="space-y-2">
                    {store.resumeProfile.workExperience.map((work, idx) => (
                      <div key={work.id || idx} className="bg-slate-850 p-2 rounded border border-darkBorder/60">
                        <span className="text-[9px] font-bold text-accentCyan block mb-1 truncate">{work.company} ({work.role})</span>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                          <button
                            onClick={() => { handleAutofill(work.company); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Company Name
                          </button>
                          <button
                            onClick={() => { handleAutofill(work.role); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Role Title
                          </button>
                          <button
                            onClick={() => { handleAutofill(work.location || ''); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Location
                          </button>
                          <button
                            onClick={() => { handleAutofill(`${work.startDate} - ${work.endDate}`); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Duration
                          </button>
                          <button
                            onClick={() => { handleAutofill(work.shortSummary || ''); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer col-span-2"
                          >
                            Short Summary
                          </button>
                          <button
                            onClick={() => { handleAutofill((work.responsibilities || []).map(r => `• ${r}`).join('\n')); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer col-span-2"
                          >
                            Responsibilities List
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects Manual Fields */}
              {store.resumeProfile?.projects && store.resumeProfile.projects.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-darkBorder/40">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold block">Projects</span>
                  <div className="space-y-2">
                    {store.resumeProfile.projects.map((proj, idx) => (
                      <div key={proj.id || idx} className="bg-slate-850 p-2 rounded border border-darkBorder/60">
                        <span className="text-[9px] font-bold text-accentCyan block mb-1 truncate">{proj.name}</span>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                          <button
                            onClick={() => { handleAutofill(proj.name); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Project Name
                          </button>
                          <button
                            onClick={() => { handleAutofill(proj.techStack.join(', ')); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Tech Stack
                          </button>
                          <button
                            onClick={() => { handleAutofill(proj.description); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer col-span-2"
                          >
                            Description
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education Manual Fields */}
              {store.resumeProfile?.education && store.resumeProfile.education.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-darkBorder/40">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold block">Education</span>
                  <div className="space-y-2">
                    {store.resumeProfile.education.map((edu, idx) => (
                      <div key={idx} className="bg-slate-850 p-2 rounded border border-darkBorder/60">
                        <span className="text-[9px] font-bold text-accentCyan block mb-1 truncate">{edu.institution}</span>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                          <button
                            onClick={() => { handleAutofill(edu.institution); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Institution
                          </button>
                          <button
                            onClick={() => { handleAutofill(edu.degree); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Degree
                          </button>
                          <button
                            onClick={() => { handleAutofill(edu.fieldOfStudy); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            Field of Study
                          </button>
                          <button
                            onClick={() => { handleAutofill(edu.gpa); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer"
                          >
                            GPA
                          </button>
                          <button
                            onClick={() => { handleAutofill((edu.coursework || []).join(', ')); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer col-span-2"
                          >
                            Coursework
                          </button>
                          <button
                            onClick={() => { handleAutofill((edu.honors || []).join(', ')); setShowManualSelect(false); }}
                            className="text-left bg-slate-800 hover:bg-slate-700 p-1 rounded truncate text-slate-300 cursor-pointer col-span-2"
                          >
                            Honors & Awards
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeMatch.type === 'project_selector' ? (
            <div>
              {(() => {
                const projects = store.resumeProfile?.projects || [];
                const activeProject = projects[activeProjectIdx];
                if (projects.length === 0 || !activeProject) {
                  return <p className="text-xs text-slate-400 text-center py-4">No projects found. Add them in options!</p>;
                }
                const projectRawText = `${activeProject.description || ''}\n${(activeProject.highlights || []).map(h => `• ${h}`).join('\n')}`.trim();
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
                        <span className="text-[9px] text-slate-400 font-medium">
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
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block mb-1.5 flex justify-between">
                        <span>Tailor description to limit:</span>
                        {store.apiKey ? (
                          <span className="text-accentCyan font-normal lowercase">(Gemini AI Active)</span>
                        ) : (
                          <span className="text-red-400 font-normal lowercase">(Local fallback - locked)</span>
                        )}
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
                        onClick={() => handleAutofill(projectRawText)}
                        disabled={tailoringLoading}
                        className="flex-1 bg-accentCyan hover:bg-cyan-500 disabled:opacity-50 text-darkBg font-bold py-1.5 rounded text-xs cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        {tailoringLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                        <span>{tailoringLoading ? 'Rewriting...' : 'Autofill Raw'}</span>
                      </button>
                      <button
                        onClick={() => handleCopyToClipboard(projectRawText)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-darkBorder rounded cursor-pointer text-slate-300"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-4 h-4 text-accentGreen" /> : <Clipboard className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-2.5 pt-1.5 border-t border-darkBorder/40 text-center">
                <button
                  onClick={() => setShowManualSelect(true)}
                  className="text-[9px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  🔍 Select field manually...
                </button>
              </div>
            </div>
          ) : activeMatch.type === 'experience_selector' ? (
            <div>
              {(() => {
                const experiences = store.resumeProfile?.workExperience || [];
                const activeExperience = experiences[activeExperienceIdx];
                if (experiences.length === 0 || !activeExperience) {
                  return <p className="text-xs text-slate-400 text-center py-4">No experiences found. Add them in options!</p>;
                }
                const experienceRawText = `${activeExperience.shortSummary || ''}\n${(activeExperience.responsibilities || []).map(r => `• ${r}`).join('\n')}`.trim();
                return (
                  <div>
                    {/* Carousel selector */}
                    <div className="flex items-center justify-between bg-darkBg/60 p-2.5 rounded-lg border border-darkBorder mb-3">
                      <button
                        onClick={() => setActiveExperienceIdx(prev => Math.max(0, prev - 1))}
                        disabled={activeExperienceIdx === 0}
                        className="p-1 disabled:opacity-30 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="text-center flex-1 mx-2">
                        <span className="text-xs font-bold text-slate-200 block truncate">
                          {activeExperience.company}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium block truncate">
                          {activeExperience.role}
                        </span>
                        <span className="text-[8px] text-slate-500 font-normal">
                          Experience {activeExperienceIdx + 1} of {experiences.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveExperienceIdx(prev => Math.min(experiences.length - 1, prev + 1))}
                        disabled={activeExperienceIdx === experiences.length - 1}
                        className="p-1 disabled:opacity-30 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tech stack highlight */}
                    <div className="text-[10px] text-accentCyan mb-2 font-mono truncate">
                      Stack: {(activeExperience.techStack || []).join(', ') || 'N/A'}
                    </div>

                    {/* Character/Word-limit tailoring buttons */}
                    <div className="border-t border-darkBorder/40 pt-2 mb-3">
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block mb-1.5 flex justify-between">
                        <span>Tailor summary to limit:</span>
                        {store.apiKey ? (
                          <span className="text-accentCyan font-normal lowercase">(Gemini AI Active)</span>
                        ) : (
                          <span className="text-red-400 font-normal lowercase">(Local fallback - locked)</span>
                        )}
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

                    {/* Standard fill options for current work description */}
                    <div className="flex space-x-2 pt-2 border-t border-darkBorder">
                      <button
                        onClick={() => handleAutofill(experienceRawText)}
                        disabled={tailoringLoading}
                        className="flex-1 bg-accentCyan hover:bg-cyan-500 disabled:opacity-50 text-darkBg font-bold py-1.5 rounded text-xs cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        {tailoringLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                        <span>{tailoringLoading ? 'Rewriting...' : 'Autofill Raw'}</span>
                      </button>
                      <button
                        onClick={() => handleCopyToClipboard(experienceRawText)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-darkBorder rounded cursor-pointer text-slate-300"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-4 h-4 text-accentGreen" /> : <Clipboard className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-2.5 pt-1.5 border-t border-darkBorder/40 text-center">
                <button
                  onClick={() => setShowManualSelect(true)}
                  className="text-[9px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  🔍 Select field manually...
                </button>
              </div>
            </div>
          ) : (
            /* STANDARD TEXT/SELECT FIELD VIEW */
            <div>
              <p className="text-xs text-slate-300 bg-darkBg/60 border border-darkBorder p-2.5 rounded-lg mb-3 break-words max-h-32 overflow-y-auto">
                {activeMatch.value || <span className="italic text-slate-500">Field is empty in profile</span>}
              </p>
              
              {activeMatch.fieldKey === 'setup_prompt' ? (
                <button
                  onClick={handleOpenOptions}
                  className="w-full bg-accentCyan hover:bg-zinc-200 text-darkBg font-bold py-1.5 rounded text-xs cursor-pointer transition-all hover:scale-[1.02] duration-150 flex items-center justify-center space-x-1"
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Configure Profile</span>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAutofill(activeMatch.value, activeMatch.fieldKey)}
                    disabled={!activeMatch.value}
                    className="flex-1 bg-accentCyan hover:bg-cyan-500 text-darkBg font-bold py-1.5 rounded text-xs cursor-pointer transition-colors disabled:opacity-50"
                  >
                    Autofill Field
                  </button>
                  <button
                    onClick={() => handleCopyToClipboard(activeMatch.value)}
                    disabled={!activeMatch.value}
                    className="px-3 bg-slate-800 hover:bg-slate-700 border border-darkBorder rounded text-slate-300 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-accentGreen" />
                    ) : (
                      <Clipboard className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {activeMatch.fieldKey !== 'setup_prompt' && (
                <div className="mt-3 pt-2 border-t border-darkBorder/40 text-center">
                  <button
                    onClick={() => setShowManualSelect(true)}
                    className="text-[9px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    🔍 Select field manually...
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
