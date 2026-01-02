import React, { useState, useEffect, useMemo } from 'react';
import { Note, ThemeColors, getCategoryStyle, ServiceKeys } from '../types';
import { reformatNoteContent } from '../services/geminiService';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onEdit: (note: Note) => void;
  onAiError?: () => void;
  onKeyError?: () => void;
  theme: ThemeColors;
  serviceKeys?: ServiceKeys;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete, onUpdate, onEdit, onAiError, onKeyError, theme, serviceKeys }) => {
  const [isReformatting, setIsReformatting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTags, setShowTags] = useState(false);

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
    const shareData = { title: note.headline, text: note.content };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      } catch (err) { if ((err as Error).name === 'AbortError') return; }
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
            if (listsResponse.status === 401) {
              if (onKeyError) onKeyError();
              throw new Error('TOKEN_EXPIRED');
            }
            if (!listsResponse.ok) throw new Error('LIST_FETCH_FAIL');
            const listsData = await listsResponse.json();
            let targetListId = listsData.items?.find((l: any) => l.title === LIST_TITLE)?.id;
            if (!targetListId) {
                const createListResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: LIST_TITLE })
                });
                if (!createListResponse.ok) throw new Error('LIST_CREATE_FAIL');
                const newList = await createListResponse.json();
                targetListId = newList.id;
            }
            const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${targetListId}/tasks`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: note.headline, notes: note.content })
            });
            if (!response.ok) throw new Error("API_FAIL");
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } finally { setIsSyncing(false); }
        return;
    }
    try { await navigator.clipboard.writeText(`${note.headline}\n\n${note.content}`); } catch (e) {}
    window.open('https://tasks.google.com/', '_blank');
  };

  const handleExportToCalendar = async () => {
    if (!note.eventDetails) return;
    if (serviceKeys?.calendar) {
        setIsSyncing(true);
        const token = serviceKeys.calendar.trim();
        try {
            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: note.eventDetails.title,
                    description: note.content,
                    start: { dateTime: note.eventDetails.start },
                    end: { dateTime: note.eventDetails.end }
                })
            });
            if (response.status === 401) {
              if (onKeyError) onKeyError();
              throw new Error('TOKEN_EXPIRED');
            }
            if (!response.ok) throw new Error("API_FAIL");
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } finally { setIsSyncing(false); }
    } else {
        const { title, start, end } = note.eventDetails;
        const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(note.content)}&dates=${start.replace(/[-:]/g, '')}/${end.replace(/[-:]/g, '')}`;
        window.open(gCalUrl, '_blank');
    }
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

  const renderContentWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-white opacity-30 underline underline-offset-4 decoration-1 hover:opacity-100 transition-all duration-300"
            onClick={(e) => e.stopPropagation()} 
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const style = getCategoryStyle(note.category);
  const cardBg = theme.key === 'pro' ? '#1E2228' : '#22241B';

  const isProcessed = note.aiStatus === 'completed';
  const intent = note.intent || 'reference';
  
  // Dynamic Export Bar logic
  const isTaskPrimary = intent === 'task';
  const isEphemeralPrimary = intent === 'ephemeral';
  const isReferencePrimary = intent === 'reference' || (!isTaskPrimary && !isEphemeralPrimary);

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
        
        <div 
            onClick={() => isLong && setIsExpanded(!isExpanded)}
            className={`relative group/content cursor-pointer mb-6 transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px]' : 'max-h-32'}`}
        >
            <div className={`${theme.subtleText} text-base font-normal leading-relaxed whitespace-pre-wrap ${isReformatting ? 'opacity-50' : ''}`}>
                {isExpanded ? renderContentWithLinks(note.content) : renderContentWithLinks(previewText)}
            </div>
            {isLong && !isExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none transition-opacity duration-300" style={{ background: `linear-gradient(transparent, ${cardBg})` }} />
            )}
            {isLong && (
                <div className={`mt-1 flex justify-center ${theme.primaryText} opacity-0 group-hover/content:opacity-60 transition-all duration-300`}>
                    <span className="material-symbols-rounded text-xl leading-none">
                        {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                    </span>
                </div>
            )}
        </div>

        {/* COMPACT TAGS INTERFACE */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
            <button 
                onClick={(e) => { e.stopPropagation(); setShowTags(!showTags); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/5 ${theme.surface} hover:bg-white/10 transition-all active:scale-95 shadow-sm group/tagbtn`}
                title="View Tags"
            >
                <span className={`material-symbols-rounded text-sm transition-transform duration-300 ${theme.primaryText} ${showTags ? 'rotate-12 scale-110' : 'group-hover/tagbtn:rotate-12'}`}>local_offer</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{note.tags.length}</span>
            </button>
            
            {showTags && note.tags.map((tag, idx) => (
                <span 
                    key={idx} 
                    className={`${theme.primaryText} text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-300`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                >
                    #{tag}
                </span>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {note.calendarSync && (
            <button 
              onClick={handleExportToCalendar}
              className="w-12 h-12 flex-shrink-0 rounded-full transition-all flex items-center justify-center shadow-lg active:scale-90 bg-[#C2E7FF] text-[#003258] animate-in zoom-in duration-300"
              title="Schedule Calendar Event"
            >
              <span className="material-symbols-rounded text-2xl">calendar_month</span>
            </button>
          )}

          {/* Tasks Export */}
          <button 
            onClick={handleExportToTasks} 
            disabled={isSyncing}
            className={`transition-all duration-500 flex items-center justify-center shadow-lg active:scale-90 relative 
              ${isTaskPrimary ? 'flex-1 min-w-[100px] h-12 rounded-full px-5 gap-2 ring-2 ring-offset-2 ring-offset-[#22241B] ring-[#3F7DE3]' : 'w-12 h-12 flex-shrink-0 rounded-full'}
              ${syncStatus === 'success' && !isSyncing ? 'bg-[#C1CC94] text-[#191A12]' : syncStatus === 'error' ? 'bg-[#FFB4AB] text-[#601410]' : 'bg-[#D3E3FD] text-[#041E49] hover:bg-[#A8C7FA]'}
            `}
            title="Send to Tasks"
          >
            <span className={`material-symbols-rounded text-2xl ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : (syncStatus === 'error' ? 'error' : 'task_alt')}</span>
            {isTaskPrimary && <span className="text-[10px] font-black uppercase tracking-widest">Tasks</span>}
            {isTaskPrimary && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#3F7DE3] rounded-full border border-black shadow-sm" />}
          </button>
          
          {/* Keep Export */}
          <button 
            onClick={handleExportToKeep}
            className={`transition-all duration-500 border border-[#444746] ${theme.surface} flex items-center justify-center shadow-sm hover:bg-white/5 active:scale-95 relative
              ${isEphemeralPrimary ? 'flex-1 min-w-[80px] h-12 rounded-full px-5 gap-2 ring-2 ring-offset-2 ring-offset-[#22241B] ring-[#D9C559]' : 'w-12 h-12 flex-shrink-0 rounded-full'}
            `}
            title="Send to Keep"
          >
            <span className="material-symbols-rounded text-xl" style={{ color: isEphemeralPrimary ? '#D9C559' : undefined }}>
                {syncStatus === 'success' ? 'done' : 'share'}
            </span>
            {isEphemeralPrimary && <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#D9C559' }}>Keep</span>}
            {isEphemeralPrimary && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#D9C559] rounded-full border border-black shadow-sm" />}
          </button>
          
          {/* Obsidian Export */}
          <button 
            onClick={handleExportToObsidian} 
            className={`transition-all duration-500 border border-[#444746] ${theme.surface} flex items-center justify-center shadow-sm hover:bg-white/5 relative
              ${isReferencePrimary ? 'flex-1 min-w-[100px] h-12 rounded-full px-5 gap-2 ring-2 ring-offset-2 ring-offset-[#22241B] ring-[#D0BCFF]' : 'w-12 h-12 flex-shrink-0 rounded-full'}
            `}
            title="Send to Obsidian"
          >
            <span className="material-symbols-rounded text-xl" style={{ color: isReferencePrimary ? '#D0BCFF' : undefined }}>
              diamond
            </span>
            {isReferencePrimary && <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#D0BCFF' }}>Obsidian</span>}
            {isReferencePrimary && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#D0BCFF] rounded-full border border-black shadow-sm" />}
          </button>
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