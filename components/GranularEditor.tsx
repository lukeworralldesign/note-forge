
import React, { useState, useEffect, useRef } from 'react';
import { Note, ThemeColors } from '../types';
import { performAISuggestion, generateBespokeSuggestions } from '../services/geminiService';

interface GranularEditorProps {
  note: Note;
  theme: ThemeColors;
  onClose: () => void;
  onSave: (id: string, content: string) => void;
}

interface BespokeSuggestion {
  label: string;
  icon: string;
  intent: string;
}

const GranularEditor: React.FC<GranularEditorProps> = ({ note, theme, onClose, onSave }) => {
  const [content, setContent] = useState(note.content);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeIntent, setActiveIntent] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<BespokeSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    
    const fetchSuggestions = async () => {
        setIsLoadingSuggestions(true);
        try {
            const bespokes = await generateBespokeSuggestions(note.content);
            setSuggestions(bespokes);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };
    fetchSuggestions();

    const handleViewportResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
      setViewportHeight(window.visualViewport.height);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
    };
  }, [note.id]);

  const handleSuggestion = async (suggestion: BespokeSuggestion) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setActiveIntent(suggestion.intent);
    try {
      const updated = await performAISuggestion(content, suggestion.intent);
      if (updated) {
        setContent(prev => {
          const separator = prev.endsWith('\n\n') ? '' : prev.endsWith('\n') ? '\n' : '\n\n';
          return prev + separator + updated;
        });
        
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      setActiveIntent(null);
    }
  };

  const handleDone = () => {
    onSave(note.id, content);
    onClose();
  };

  const getFocusModeOverlayColor = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const isSquished = viewportHeight < window.innerHeight * 0.75;

  return (
    <div 
      className="fixed inset-0 z-[15000] flex items-center justify-center overflow-hidden"
      style={{ height: `${viewportHeight}px` }}
    >
      <div 
        className="absolute inset-0 backdrop-blur-sm animate-in fade-in duration-700 cursor-zoom-out" 
        style={{ backgroundColor: getFocusModeOverlayColor(theme.bg, 0.4) }}
        onClick={handleDone}
      />

      <div className={`
        relative w-full max-w-6xl h-full flex flex-col overflow-hidden
        ${theme.surface} shadow-[0_48px_160px_-32px_rgba(0,0,0,1)]
        animate-in zoom-in-95 slide-in-from-bottom-12 duration-700
        rounded-[2.5rem] ring-4 ${theme.focusRing}
        will-change-[transform,margin,border-radius]
        transition-[margin,border-radius,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
        ${isSquished ? 'm-2 md:m-4' : 'm-4 md:m-12 max-h-[92vh] md:max-h-[86vh]'}
      `}>
        
        <header className={`
          px-6 flex items-center justify-between flex-shrink-0 bg-white/[0.01] border-b border-white/5 
          transition-[padding] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
          ${isSquished ? 'py-3' : 'py-6 md:py-8'}
        `}>
          <div className="flex flex-col min-w-0 pr-4">
            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] md:tracking-[0.7em] ${theme.primaryText} mb-1 opacity-70 transition-opacity duration-500 ${isSquished ? 'opacity-0 h-0 overflow-hidden' : 'opacity-70'}`}>
              Knowledge Forge Expanded
            </span>
            <h2 className={`text-white font-bold tracking-tight truncate opacity-95 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isSquished ? 'text-base' : 'text-lg md:text-3xl'}`} style={{ fontVariationSettings: '"wght" 700' }}>
              {note.headline}
            </h2>
          </div>
          <button 
            onClick={handleDone}
            className={`
              rounded-xl md:rounded-[24px] 
              ${theme.primaryBg} ${theme.onPrimaryText} 
              text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] 
              shadow-xl active:scale-95 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
              flex items-center gap-2 flex-shrink-0
              ${isSquished ? 'h-10 px-5' : 'h-12 md:h-16 px-6 md:px-10'}
            `}
          >
            <span className="hidden xs:inline">Finalize</span>
            <span className={`material-symbols-rounded ${isSquished ? 'text-lg' : 'text-xl md:text-2xl'}`}>save</span>
          </button>
        </header>

        <div className={`
          flex-1 relative flex flex-col overflow-hidden transition-[padding] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
          ${isSquished ? 'px-5 py-3' : 'px-8 py-6 md:px-12 md:py-10'}
        `}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`
              w-full h-full bg-transparent text-[#FDFDFF] 
              placeholder-white/5 focus:outline-none resize-none leading-relaxed
              font-medium tracking-tight transition-all duration-700
              ${isProcessing ? 'opacity-20 blur-2xl scale-[0.97]' : 'opacity-100 scale-100'}
              ${isSquished ? 'text-base md:text-xl' : 'text-xl md:text-3xl'}
            `}
            placeholder="Forge your multi-paragraph thoughts..."
            style={{ fontVariationSettings: '"wght" 450' }}
          />

          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className={`flex flex-col items-center animate-in zoom-in duration-500 ${isSquished ? 'gap-4' : 'gap-8'}`}>
                  <div className={`rounded-full border-t-transparent border-${theme.primaryText} animate-spin shadow-[0_0_60px_${theme.accentHex}66] ${isSquished ? 'w-12 h-12 border-[4px]' : 'w-20 h-20 md:w-28 md:h-28 border-[8px] md:border-[10px]'}`}></div>
                  <div className="flex flex-col items-center gap-1 md:gap-3">
                    <span className={`font-black uppercase tracking-[0.4em] md:tracking-[0.8em] ${theme.primaryText} animate-pulse ${isSquished ? 'text-[8px]' : 'text-[11px] md:text-[13px]'}`}>
                        Synthesizing
                    </span>
                  </div>
               </div>
            </div>
          )}
        </div>

        <div className={`
          bg-black/40 backdrop-blur-md border-t border-white/10 transition-[padding] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
          ${isSquished ? 'p-4 pb-6' : 'p-8 pb-10 md:p-12 md:pb-16'}
        `}>
           <div className={`flex items-center gap-3 opacity-30 transition-all duration-500 ${isSquished ? 'mb-3' : 'mb-6'}`}>
              <span className={`material-symbols-rounded ${isSquished ? 'text-base' : 'text-2xl'}`}>psychology_alt</span>
              <span className={`font-black uppercase tracking-[0.4em] md:tracking-[0.7em] text-white ${isSquished ? 'text-[8px]' : 'text-[10px]'}`}>
                  {isLoadingSuggestions ? 'Analyzing...' : 'Contextual Appends'}
              </span>
           </div>
           
           <div className="flex overflow-x-auto gap-4 md:gap-8 no-scrollbar scroll-smooth">
              {isLoadingSuggestions ? (
                 [1,2,3,4].map(i => (
                   <div key={i} className={`flex-shrink-0 bg-white/5 rounded-2xl animate-pulse flex items-center gap-3 border border-white/5 ${isSquished ? 'w-40 h-12 px-4' : 'w-52 md:w-72 h-16 md:h-24 px-6 md:px-10'}`}>
                      <div className={`rounded-full bg-white/10 ${isSquished ? 'w-5 h-5' : 'w-8 h-8 md:w-10 md:h-10'}`}></div>
                      <div className="flex-1 h-2 bg-white/10 rounded-full"></div>
                   </div>
                 ))
              ) : (
                  suggestions.map((s, idx) => (
                      <button
                          key={idx}
                          onClick={() => handleSuggestion(s)}
                          disabled={isProcessing}
                          className={`
                          flex-shrink-0 flex items-center rounded-2xl md:rounded-[32px] 
                          backdrop-blur-xl border transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-90
                          animate-in slide-in-from-right-16 fade-in
                          ${isSquished ? 'gap-3 px-5 h-12' : 'gap-4 md:gap-6 px-8 md:px-12 h-16 md:h-24'}
                          ${activeIntent === s.intent 
                            ? `${theme.primaryBg} ${theme.onPrimaryText} border-transparent shadow-[0_0_40px_${theme.accentHex}99]` 
                            : `bg-white/[0.04] border-white/10 text-white/80 hover:bg-white/10 hover:border-white/30 hover:text-white hover:translate-y-[-4px]`}
                          `}
                          style={{ animationDelay: `${idx * 80}ms` }}
                      >
                          <span className={`material-symbols-rounded ${isSquished ? 'text-xl' : 'text-3xl md:text-5xl'}`}>{s.icon || 'auto_awesome'}</span>
                          <span className={`font-bold uppercase whitespace-nowrap ${isSquished ? 'text-[10px] tracking-[0.15em]' : 'text-[12px] md:text-[15px] tracking-[0.2em] md:tracking-[0.3em]'}`}>
                            {s.label}
                          </span>
                      </button>
                  ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default GranularEditor;
