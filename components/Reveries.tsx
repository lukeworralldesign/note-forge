import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Note, ThemeColors, getCategoryStyle } from '../types';
import DataTransfer from './DataTransfer';

interface ReveriesProps {
  notes: Note[];
  theme: ThemeColors;
  isOpen: boolean;
  onClose: () => void;
  swipeOffset: number;
  isSwiping: boolean;
  onNoteClick: (id: string) => void;
  onImport: (importedNotes: Note[]) => void;
  getFocusModeOverlayColor: (hex: string, alpha: number) => string;
  backdropOpacity: number;
  transform: string;
}

/**
 * Custom Dice Icon component that renders standard dot patterns on a 3x3 grid.
 */
const DiceIcon: React.FC<{ value: number; color: string; className?: string }> = ({ value, color, className = "" }) => {
  // Mapping values to grid cell indexes (0-8)
  const dotMap: Record<number, number[]> = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  const activeDots = dotMap[value] || [];

  return (
    <div className={`grid grid-cols-3 grid-rows-3 gap-0.5 w-5 h-5 p-0.5 rounded-[4px] border-[1.5px] ${className}`} style={{ borderColor: color }}>
      {[...Array(9)].map((_, i) => (
        <div 
          key={i} 
          className={`w-1 h-1 rounded-full transition-opacity duration-150 ${activeDots.includes(i) ? 'opacity-100' : 'opacity-0'}`} 
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};

const Reveries: React.FC<ReveriesProps> = ({ 
  notes, 
  theme, 
  isOpen, 
  onClose, 
  swipeOffset, 
  isSwiping,
  onNoteClick,
  onImport,
  getFocusModeOverlayColor,
  backdropOpacity,
  transform
}) => {
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDiceValue, setCurrentDiceValue] = useState(5);
  const rollIntervalRef = useRef<number | null>(null);

  const pickRandomNotes = useCallback(() => {
    if (notes.length === 0) {
      setSelectedNotes([]);
      return;
    }
    const shuffled = [...notes].sort(() => 0.5 - Math.random());
    setSelectedNotes(shuffled.slice(0, 3));
  }, [notes]);

  // Handle initial pick
  useEffect(() => {
    if (isOpen && selectedNotes.length === 0 && notes.length > 0) {
      pickRandomNotes();
    }
  }, [isOpen, notes.length, pickRandomNotes, selectedNotes.length]);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    // Rapidly cycle through numeric values to simulate a high-speed roll
    let rolls = 0;
    const maxRolls = 10;
    rollIntervalRef.current = window.setInterval(() => {
      setCurrentDiceValue(Math.floor(Math.random() * 6) + 1);
      rolls++;
      if (rolls >= maxRolls) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      }
    }, 60);

    setTimeout(() => {
      pickRandomNotes();
      setIsRefreshing(false);
      // Final settle
      setCurrentDiceValue(Math.floor(Math.random() * 6) + 1);
    }, 600); 
  };

  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-[9999] overflow-y-auto anti-alias-container backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] touch-pan-y ${isSwiping ? 'duration-0' : ''}`}
      style={{ 
        backgroundColor: getFocusModeOverlayColor(theme.bg, backdropOpacity),
        transform: transform,
        visibility: (isOpen || isSwiping) ? 'visible' : 'hidden'
      }}
    >
      <style>
        {`
          @keyframes dice-roll-tactile {
            0% { transform: rotate(0deg) scale(1) translate(0, 0); }
            10% { transform: rotate(-25deg) scale(1.4) translate(-4px, -14px); }
            30% { transform: rotate(140deg) scale(0.8) translate(6px, 8px); }
            50% { transform: rotate(220deg) scale(1.2) translate(-3px, -5px); }
            75% { transform: rotate(320deg) scale(0.9) translate(3px, 3px); }
            100% { transform: rotate(360deg) scale(1) translate(0, 0); }
          }
          .animate-dice-roll {
            animation: dice-roll-tactile 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
        `}
      </style>
      <div className="max-w-5xl mx-auto px-5 w-full min-h-full flex flex-col pointer-events-auto pt-safe pb-safe">
        <div className="pt-10 pb-10 flex items-center justify-between flex-shrink-0">
          <div className="flex flex-col">
            <h1 
              className="text-3xl md:text-5xl text-[#E3E2E6] tracking-tight transition-all duration-700" 
              style={{ fontVariationSettings: '"wght" 600, "wdth" 100, "slnt" 0' }}
            >
              reveries
            </h1>
            <div className={`flex items-center gap-2 ${theme.primaryText} text-[10px] font-bold uppercase tracking-[0.2em] mt-2 opacity-60`}>
              INTELLIGENT RECALL
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={handleRefresh}
                disabled={notes.length === 0 || isRefreshing}
                className={`w-12 h-12 rounded-full ${theme.surface} flex items-center justify-center text-[#E3E2E6] shadow-xl active:scale-90 border border-white/10 hover:bg-white/10 transition-all overflow-hidden`}
                title="Shuffle Reveries"
              >
                <div className={`${isRefreshing ? 'animate-dice-roll' : ''}`}>
                  <DiceIcon 
                    value={currentDiceValue} 
                    color={isRefreshing ? '#C1CC94' : 'rgba(255,255,255,0.6)'} 
                    className="transition-colors duration-300"
                  />
                </div>
              </button>
              <button 
                onClick={onClose} 
                className={`w-12 h-12 rounded-full ${theme.surface} flex items-center justify-center text-[#E3E2E6] shadow-xl active:scale-90 border border-white/10 hover:bg-white/10 transition-all`}
              >
                <span className="material-symbols-rounded text-2xl">close</span>
              </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-6 pb-24">
            {selectedNotes.length > 0 ? (
                selectedNotes.map((note, index) => {
                    const style = getCategoryStyle(note.category);
                    return (
                        <div 
                            key={`${note.id}-${isRefreshing}`} 
                            onClick={() => onNoteClick(note.id)}
                            className={`group relative ${theme.surface} p-8 rounded-[2rem] border border-white/5 cursor-pointer hover:border-white/20 transition-all shadow-2xl animate-in slide-in-from-left-8 fade-in duration-500`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <span className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase shadow-sm" style={{ backgroundColor: style.bg, color: style.text }}>
                                    {note.category}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                    {new Date(note.timestamp).toLocaleDateString()}
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold text-[#E3E2E6] mb-4 tracking-tight leading-tight group-hover:text-white transition-colors">
                                {note.headline}
                            </h3>
                            <p className={`${theme.subtleText} text-base leading-relaxed opacity-60 line-clamp-3 mb-6`}>
                                {note.content}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.primaryText} group-hover:opacity-100 opacity-40 transition-opacity`}>Deep Recall</span>
                                <span className={`material-symbols-rounded text-lg ${theme.primaryText} group-hover:translate-x-1 transition-transform opacity-40 group-hover:opacity-100`}>arrow_forward</span>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 gap-4">
                    <span className="material-symbols-rounded text-6xl">visibility_off</span>
                    <div className="flex flex-col">
                        <span className="text-sm font-black uppercase tracking-widest">No Echoes Found</span>
                        <span className="text-[10px] uppercase tracking-widest mt-1">Add more notes to trigger serendipity</span>
                    </div>
                </div>
            )}
            
            {notes.length > 0 && (
                 <div className="mt-8 flex flex-col items-center gap-8">
                    <div className="flex flex-col items-center gap-4 w-full">
                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.subtleText} opacity-40`}>Transfer Hub</span>
                        <DataTransfer notes={notes} onImport={onImport} theme={theme} className="max-w-md w-full" />
                    </div>

                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] max-w-xs text-center leading-relaxed">
                        Reveries resurface random thoughts from your neural collection to spark new connections.
                    </p>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Reveries;