
import React, { useState, useEffect, useMemo } from 'react';
import { Note, ThemeColors, getCategoryStyle, ServiceKeys } from '../types';
import { reformatNoteContent } from '../services/geminiService';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onEdit: (note: Note) => void;
  onAiError?: () => void;
  theme: ThemeColors;
  serviceKeys?: ServiceKeys;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete, onUpdate, onEdit, onAiError, theme, serviceKeys }) => {
  const [isReformatting, setIsReformatting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDeleteConfirm(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showDeleteConfirm]);

  const handleExportToObsidian = async () => {
    const noteBody = note.content;
    const sanitizedHeadline = note.headline.replace(/[\\/:"*?<>|]/g, '').trim().substring(0, 50);
    const obsidianUri = `obsidian://new?name=${encodeURIComponent(sanitizedHeadline || note.id)}&content=${encodeURIComponent(noteBody)}`;
    try { await navigator.clipboard.writeText(noteBody); } catch (e) {}
    window.location.href = obsidianUri;
  };

  const handleExportToKeep = async () => {
    const shareData = {
      title: note.headline,
      text: note.content,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    const fullText = `${note.headline}\n\n${note.content}`;
    try { await navigator.clipboard.writeText(fullText); } catch (e) {}
    setSyncStatus('success');
    setTimeout(() => {
        setSyncStatus('idle');
        window.open('https://keep.google.com/', '_blank');
    }, 1000);
  };

  const handleExportToTasks = async () => {
    if (serviceKeys?.tasks) {
        setIsSyncing(true);
        const token = serviceKeys.tasks.trim();
        const LIST_TITLE = 'note-forge';
        
        try {
            const listsResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!listsResponse.ok) throw new Error('LIST_FETCH_FAIL');
            const listsData = await listsResponse.json();
            
            let targetListId = listsData.items?.find((l: any) => l.title === LIST_TITLE)?.id;

            if (!targetListId) {
                const createListResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ title: LIST_TITLE })
                });
                if (!createListResponse.ok) throw new Error('LIST_CREATE_FAIL');
                const newList = await createListResponse.json();
                targetListId = newList.id;
            }

            const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;
            const dueTimestamp = new Date(Date.now() + TWO_HOURS_IN_MS).toISOString();

            const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${targetListId}/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: note.headline,
                    notes: note.content,
                    due: dueTimestamp 
                })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error("API_FAIL");

            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } finally {
            setIsSyncing(false);
        }
        return;
    }
    
    try { await navigator.clipboard.writeText(`${note.headline}\n\n${note.content}`); } catch (e) {}
    window.open('https://tasks.google.com/', '_blank');
  };

  const handleReformat = async () => {
    if (isReformatting) return;
    setIsReformatting(true);
    try {
        const newContent = await reformatNoteContent(note.content, note.ragEnabled);
        if (newContent) onUpdate(note.id, { content: newContent, originalContent: note.content });
    } catch (e) { if (onAiError) onAiError(); } finally { setIsReformatting(false); }
  };

  const { previewText, isLong } = useMemo(() => {
    const words = note.content.trim().split(/\s+/);
    const isLong = words.length > 25;
    const previewText = isLong ? words.slice(0, 25).join(' ') + '...' : note.content;
    return { previewText, isLong };
  }, [note.content]);

  const style = getCategoryStyle(note.category);
  const cardBg = theme.key === 'pro' ? '#1E2228' : '#22241B';

  return (
    <div className="masonry-item group relative">
      <div className={`${theme.key === 'pro' ? 'bg-[#1E2228]' : 'bg-[#22241B]'} rounded-[1.5rem] p-5 border ${theme.surfaceBorder} overflow-hidden transition-all duration-300 relative`}>
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase" style={{ backgroundColor: style.bg, color: style.text }}>
              {note.category}
            </span>
            {note.ragEnabled && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 ${theme.primaryText} text-[8px] font-black uppercase tracking-[0.1em]`}>
                    <span className="material-symbols-rounded text-[10px]">database</span>
                    <span>Context</span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(note)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#3F4042] text-[#8E9099]"><span className="material-symbols-rounded text-[18px]">edit</span></button>
            <button onClick={handleReformat} disabled={isReformatting} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isReformatting ? `${theme.primaryText} animate-pulse` : `text-[#8E9099] hover:bg-[#3F4042]`} `}><span className="material-symbols-rounded text-[20px]">auto_awesome</span></button>
            <button onClick={() => setShowDeleteConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#3F4042] text-[#8E9099]"><span className="material-symbols-rounded text-[18px]">delete</span></button>
          </div>
        </div>

        <h3 className="text-xl font-bold text-[#E3E2E6] mb-2 leading-tight">{note.headline}</h3>
        
        {/* Content Area with Fade Logic */}
        <div 
            onClick={() => isLong && setIsExpanded(!isExpanded)}
            className={`relative group/content cursor-pointer mb-6 transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px]' : 'max-h-32'}`}
        >
            <p className={`${theme.subtleText} text-base font-normal leading-relaxed whitespace-pre-wrap ${isReformatting ? 'opacity-50' : ''}`}>
                {isExpanded ? note.content : previewText}
            </p>
            
            {/* Fade Overlay for long notes */}
            {isLong && !isExpanded && (
                <div 
                    className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none transition-opacity duration-300"
                    style={{ 
                        background: `linear-gradient(transparent, ${cardBg})`
                    }}
                />
            )}

            {/* Hint for long notes */}
            {isLong && (
                <div className={`mt-2 text-[9px] font-black uppercase tracking-widest ${theme.primaryText} opacity-0 group-hover/content:opacity-40 transition-opacity`}>
                    {isExpanded ? 'Click to collapse' : 'Click to read more'}
                </div>
            )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
            {note.tags.map((tag, idx) => (
            <span key={idx} className={`${theme.primaryText} text-xs font-medium opacity-80`}>#{tag}</span>
            ))}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportToTasks} 
            disabled={isSyncing}
            className={`w-12 h-12 flex-shrink-0 rounded-full transition-all flex items-center justify-center shadow-lg active:scale-90 ${syncStatus === 'success' && !isSyncing ? 'bg-[#C1CC94] text-[#191A12]' : syncStatus === 'error' ? 'bg-[#FFB4AB] text-[#601410]' : 'bg-[#D3E3FD] text-[#041E49] hover:bg-[#A8C7FA]'}`}
          >
            <span className={`material-symbols-rounded text-2xl ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : (syncStatus === 'error' ? 'error' : 'task_alt')}</span>
          </button>
          
          <button 
            onClick={handleExportToKeep}
            className={`flex-1 h-12 rounded-full transition-all border border-[#444746] ${theme.surface} ${theme.primaryText} text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:bg-white/5 active:scale-95`}
          >
            <span className="material-symbols-rounded text-lg">
                {syncStatus === 'success' ? 'done' : 'share'}
            </span>
            {syncStatus === 'success' ? 'Shared' : 'To Keep'}
          </button>
          
          <button onClick={handleExportToObsidian} className={`flex-1 h-12 rounded-full border border-[#444746] ${theme.surface} ${theme.primaryText} text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:bg-white/5 transition-colors`}><span className="material-symbols-rounded text-lg">diamond</span>Obsidian</button>
        </div>

        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 p-4 bg-[#601410]/95 backdrop-blur-md flex flex-col items-center justify-center text-center rounded-[1.5rem]">
              <h4 className="text-lg font-bold text-white mb-5 tracking-tight">Purge Entry?</h4>
              <div className="flex flex-col w-full gap-2 max-w-[180px]">
                  <button onClick={() => onDelete(note.id)} className="w-full py-2.5 rounded-full bg-[#B3261E] text-[#FFB4AB] font-bold uppercase tracking-widest text-[10px]">Confirm</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-2.5 rounded-full bg-white/10 text-[#FFDAD6] font-bold uppercase tracking-widest text-[10px]">Cancel</button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteCard;
