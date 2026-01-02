import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Note, ModelTier, ThemeColors, getCategoryStyle, ServiceKeys } from './types';
import { setModelTier as setServiceTier, getLocalEmbedding, initLocalEmbedder, processNoteWithAI } from './services/geminiService';
import TheForge from './components/TheForge';
import NoteCard from './components/NoteCard';
import FidgetStar from './components/FidgetStar';
import ContextManager from './components/ContextManager';
import KeyVault from './components/KeyVault';
import DataTransfer from './components/DataTransfer';
import ActivityInsights from './components/ActivityInsights';
// @ts-ignore
import { create, insert, search, remove, update } from '@orama/orama';

const LOCAL_STORAGE_KEY = 'note_forge_v1';

const THEMES: Record<ModelTier, ThemeColors> = {
  flash: {
    key: 'flash', bg: '#191A12', surface: 'bg-[#2B2D21]', surfaceHover: 'hover:bg-[#2A2C22]', surfaceBorder: 'border-[#444746]/30', primaryText: 'text-[#C1CC94]', primaryBg: 'bg-[#C1CC94]', onPrimaryText: 'text-[#191A12]', secondaryBg: 'bg-[#3F4010]', secondaryHover: 'hover:bg-[#4E5014]', secondaryText: 'text-[#E3E2E6]', accentHex: '#C1CC94', focusRing: 'ring-[#C1CC94]', border: 'border-[#C1CC94]', subtleText: 'text-[#C4C7C5]'
  },
  pro: {
    key: 'pro', bg: '#0E1216', surface: 'bg-[#1E2228]', surfaceHover: 'hover:bg-[#252A31]', surfaceBorder: 'border-[#444746]/30', primaryText: 'text-[#C2E7FF]', primaryBg: 'bg-[#C2E7FF]', onPrimaryText: 'text-[#003258]', secondaryBg: 'bg-[#004A77]', secondaryHover: 'hover:bg-[#005D95]', secondaryText: 'text-[#C2E7FF]', accentHex: '#C2E7FF', focusRing: 'ring-[#C2E7FF]', border: 'border-[#C2E7FF]', subtleText: 'text-[#C3C7CF]'
  }
};

const LOGO_VARIATIONS = [
  { wght: 400, wdth: 100, fontVariationSettings: '"wght" 400, "wdth" 100, "slnt" 0, "GRAD" 0, "ROND" 0' },
  { wght: 400, wdth: 100, fontVariationSettings: '"wght" 400, "wdth" 100, "slnt" -10, "GRAD" 0, "ROND" 0' },
  { wght: 1000, wdth: 100, fontVariationSettings: '"wght" 1000, "wdth" 100, "slnt" 0, "GRAD" 0, "ROND" 0' },
  { wght: 1000, wdth: 100, fontVariationSettings: '"wght" 1000, "wdth" 100, "slnt" 0, "GRAD" 100, "ROND" 100' },
];

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [geminiError, setGeminiError] = useState(false);
  const [logoVarIdx, setLogoVarIdx] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editRagEnabled, setEditRagEnabled] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  
  const [modelTier, setModelTier] = useState<ModelTier>(() => {
    const stored = localStorage.getItem('note_forge_model_tier') as ModelTier;
    return ['flash', 'pro'].includes(stored) ? stored : 'flash';
  });
  const [serviceKeys, setServiceKeys] = useState<ServiceKeys>({});
  const [oramaDb, setOramaDb] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isReprocessingAI, setIsReprocessingAI] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number, total: number } | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Share Target State
  const [isShareLaunch, setIsShareLaunch] = useState(false);
  const [shareStatus, setShareStatus] = useState<'active' | 'success' | 'closing' | 'idle'>('idle');

  // Gesture State
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0); 
  const [pullOffset, setPullOffset] = useState(0); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [wasSwipedOpen, setWasSwipedOpen] = useState(false); 
  const touchStartPos = useRef<{ x: number, y: number, time: number } | null>(null);
  const lastGestureEndTime = useRef<number>(0);
  const swipeLockedOn = useRef<'insights' | 'overview' | 'pull' | null>(null);
  const screenWidth = useRef(window.innerWidth);
  const screenHeight = useRef(window.innerHeight);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => { 
        screenWidth.current = window.innerWidth;
        screenHeight.current = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (Date.now() - lastGestureEndTime.current < 250 || isRefreshing) return;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    setIsSwiping(false);
    setSwipeOffset(0);
    setPullOffset(0);
    swipeLockedOn.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || isRefreshing) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartPos.current.x;
    const deltaY = currentY - touchStartPos.current.y;

    const currentScrollTop = scrollContainerRef.current?.scrollTop || 0;

    if (!isSwiping) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      if (absX > 15 && absX > absY * 1.5) {
        setIsSwiping(true);
        if (showInsights) swipeLockedOn.current = 'insights';
        else if (showOverview) swipeLockedOn.current = 'overview';
        else swipeLockedOn.current = deltaX > 0 ? 'insights' : 'overview';
      } 
      else if (deltaY > 15 && absY > absX * 1.5 && currentScrollTop <= 2 && !showInsights && !showOverview) {
        setIsSwiping(true);
        swipeLockedOn.current = 'pull';
      } else if (absY > 20) {
        touchStartPos.current = null;
        return;
      }
    }

    if (isSwiping) {
      if (swipeLockedOn.current === 'pull') {
        if (currentScrollTop > 5 && pullOffset === 0) {
            setIsSwiping(false);
            swipeLockedOn.current = null;
            return;
        }
        const maxStretch = screenHeight.current * 0.25;
        const pullDistance = Math.max(0, deltaY);
        const resistance = 0.4;
        setPullOffset(Math.min(pullDistance * resistance, maxStretch));
        if (e.cancelable) e.preventDefault();
      } else if (swipeLockedOn.current === 'insights') {
        setSwipeOffset(showInsights ? Math.min(0, deltaX) : Math.max(0, deltaX));
        if (e.cancelable) e.preventDefault();
      } else if (swipeLockedOn.current === 'overview') {
        setSwipeOffset(showOverview ? Math.max(0, deltaX) : Math.min(0, deltaX));
        if (e.cancelable) e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !isSwiping || isRefreshing) {
      touchStartPos.current = null;
      setIsSwiping(false);
      setPullOffset(0);
      return;
    }
    const deltaX = e.changedTouches[0].clientX - touchStartPos.current.x;
    const deltaTime = Date.now() - touchStartPos.current.time;
    const velocityX = Math.abs(deltaX) / (deltaTime || 1); 
    const threshold = screenWidth.current * 0.25; 
    const velocityThreshold = 0.3;
    let actionTriggered = false;

    if (swipeLockedOn.current === 'pull') {
        if (pullOffset > 80) {
            setIsRefreshing(true);
            setPullOffset(80);
            setTimeout(() => { window.location.replace(window.location.href); }, 800);
            actionTriggered = true;
        } else {
            setPullOffset(0);
        }
    } else if (showInsights && swipeLockedOn.current === 'insights') {
      if (deltaX < -threshold || (velocityX > velocityThreshold && deltaX < 0)) {
        setShowInsights(false);
        actionTriggered = true;
      }
    } else if (showOverview && swipeLockedOn.current === 'overview') {
      if (deltaX > threshold || (velocityX > velocityThreshold && deltaX > 0)) {
        setShowOverview(false);
        actionTriggered = true;
      }
    } else if (!showInsights && !showOverview) {
      if (swipeLockedOn.current === 'overview' && deltaX < 0) {
        if (deltaX < -threshold || (velocityX > velocityThreshold)) {
          setWasSwipedOpen(true);
          setShowOverview(true);
          actionTriggered = true;
        }
      } else if (swipeLockedOn.current === 'insights' && deltaX > 0) {
        if (deltaX > threshold || (velocityX > velocityThreshold)) {
          setShowInsights(true);
          actionTriggered = true;
        }
      }
    }
    if (actionTriggered) lastGestureEndTime.current = Date.now();
    touchStartPos.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);
    if (!actionTriggered) setPullOffset(0);
  };

  const toggleOverviewProgrammatically = (open: boolean) => {
    setWasSwipedOpen(false); 
    setShowOverview(open);
    lastGestureEndTime.current = Date.now();
  };

  useEffect(() => {
    const initEngine = async () => {
      setIsIndexing(true);
      try {
        await initLocalEmbedder(); 
        const db = await create({
          schema: {
            content: 'string', 
            headline: 'string', 
            category: 'string', 
            tags: 'string[]', 
            intent: 'string',
            embedding: 'vector[384]' 
          }
        });
        setOramaDb(db);
      } catch (e) {
        console.error("Critical Engine Init Failure:", e);
        try {
            const fallbackDb = await create({
                schema: { content: 'string', headline: 'string', category: 'string', tags: 'string[]', intent: 'string' }
            });
            setOramaDb(fallbackDb);
        } catch (innerErr) {
            console.error("Total search engine failure:", innerErr);
        }
      } finally {
        setIsIndexing(false);
      }
    };
    initEngine();
  }, []);

  useEffect(() => {
    if (!oramaDb || isReprocessingAI) return;
    const syncNotes = async () => {
      for (const note of notes) {
        const commonData = {
          id: note.id,
          content: note.content,
          headline: note.headline,
          category: note.category,
          tags: note.tags,
          intent: note.intent || 'reference'
        };
        
        if (note.embedding && note.embedding.length === 384) {
          try {
            await insert(oramaDb, {
              ...commonData,
              embedding: note.embedding
            });
          } catch (e) { }
        } else {
          try {
            await insert(oramaDb, commonData);
          } catch (e) { }
        }
      }
    };
    syncNotes();
  }, [notes, oramaDb, isReprocessingAI]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    const theme = THEMES[modelTier];
    document.documentElement.style.backgroundColor = theme.bg;
    document.body.style.backgroundColor = theme.bg;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', theme.bg);
    setServiceTier(modelTier);
    localStorage.setItem('note_forge_model_tier', modelTier);
  }, [modelTier]);

  const handleNoteSave = useCallback(async (content: string, ragEnabled: boolean) => {
    if (editingNoteId) {
      const targetId = editingNoteId;
      setEditingNoteId(null);
      setEditContent('');
      setEditRagEnabled(false);
      setNotes(prev => prev.map(n => n.id === targetId ? { ...n, content, ragEnabled, aiStatus: 'processing' } : n));
      try {
        const aiResult = await processNoteWithAI(content, ragEnabled);
        const embedding = await getLocalEmbedding(content);
        setNotes(prev => prev.map(n => n.id === targetId ? { 
          ...n, 
          ...aiResult, 
          embedding: embedding || n.embedding, 
          aiStatus: 'completed' 
        } : n));
        return aiResult;
      } catch (e) {
        setNotes(prev => prev.map(n => n.id === targetId ? { ...n, aiStatus: 'error' } : n));
      }
    } else {
      const newId = crypto.randomUUID();
      const newNote: Note = {
        id: newId, content, ragEnabled, timestamp: Date.now(), aiStatus: 'processing', category: 'Thoughts', headline: 'Analyzing...', tags: []
      };
      setNotes(prev => [newNote, ...prev]);
      try {
        const aiResult = await processNoteWithAI(content, ragEnabled);
        const embedding = await getLocalEmbedding(content);
        setNotes(current => current.map(n => n.id === newId ? { 
          ...n, 
          aiStatus: 'completed', 
          ...aiResult, 
          embedding: embedding || undefined 
        } : n));
        return aiResult;
      } catch {
        setGeminiError(true);
        setNotes(current => current.map(n => n.id === newId ? { ...n, aiStatus: 'error', category: 'Thoughts', headline: 'Note ' + new Date().toLocaleTimeString() } : n));
        throw new Error("AI Failed");
      }
    }
  }, [editingNoteId]);

  // ULTRA-FAST FIRE-AND-FORGET SHARE TARGET
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title');
    const text = params.get('text');
    const url = params.get('url');

    if (title || text || url) {
      setIsShareLaunch(true);
      setShareStatus('active');
      
      const contentParts = [];
      if (title) contentParts.push(title);
      if (text) contentParts.push(text);
      if (url) contentParts.push(url);
      const combinedContent = contentParts.join('\n\n');
      
      // 1. Commit note to Local Storage state immediately with 'idle' status
      const newId = crypto.randomUUID();
      const shareNote: Note = {
        id: newId, 
        content: combinedContent, 
        ragEnabled: false, 
        timestamp: Date.now(), 
        aiStatus: 'idle', 
        category: 'Thoughts', 
        headline: 'Shared Content', 
        tags: []
      };

      setNotes(prev => {
        const updated = [shareNote, ...prev];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });

      // 2. UI Finish Sequence: Show Fidget Star briefly then close
      setTimeout(() => {
        setShareStatus('success');
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setTimeout(() => {
          setShareStatus('closing');
          // Try to close. Many mobile browsers will allow this for share intents.
          try { window.close(); } catch (e) {}
          // Fallback if window.close doesn't work: just hide the overlay
          setTimeout(() => setIsShareLaunch(false), 500);
        }, 500);
      }, 1000);
    }
  }, []);

  // AUTOMATIC BACKGROUND FORGING
  useEffect(() => {
    // Only process background tasks if we aren't currently in a "Share Launch" window
    // and if we have notes marked as 'idle'.
    if (isShareLaunch) return;

    const idleNotes = notes.filter(n => n.aiStatus === 'idle');
    if (idleNotes.length > 0 && !isReprocessingAI) {
      const reprocessSharedContent = async () => {
        for (const note of idleNotes) {
          // Mark as processing visually
          setNotes(prev => prev.map(n => n.id === note.id ? { ...n, aiStatus: 'processing', headline: 'Forging Shared Content...' } : n));
          
          try {
            const aiResult = await processNoteWithAI(note.content, note.ragEnabled);
            const embedding = await getLocalEmbedding(note.content);
            setNotes(prev => prev.map(n => n.id === note.id ? { 
              ...n, 
              ...aiResult, 
              embedding: embedding || n.embedding, 
              aiStatus: 'completed' 
            } : n));
          } catch (e) {
            console.error("Background forging failed for note", note.id, e);
            setNotes(prev => prev.map(n => n.id === note.id ? { ...n, aiStatus: 'error' } : n));
          }
        }
      };
      reprocessSharedContent();
    }
  }, [notes, isShareLaunch, isReprocessingAI]);

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditRagEnabled(note.ragEnabled);
    setShowOverview(false);
    setShowInsights(false);
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
    setEditRagEnabled(false);
  };

  const handleRefreshMetadata = async () => {
    if (isReprocessingAI || notes.length === 0) return;
    setIsReprocessingAI(true);
    setRefreshProgress({ current: 0, total: notes.length });
    try {
      const updatedNotes = [...notes];
      for (let i = 0; i < updatedNotes.length; i++) {
        setRefreshProgress({ current: i + 1, total: notes.length });
        try {
          const aiResult = await processNoteWithAI(updatedNotes[i].content, updatedNotes[i].ragEnabled);
          updatedNotes[i] = { ...updatedNotes[i], ...aiResult, aiStatus: 'completed' };
        } catch (e) { updatedNotes[i] = { ...updatedNotes[i], aiStatus: 'error' }; }
      }
      setNotes(updatedNotes);
      if (oramaDb) {
        const db = await create({ 
          schema: { content: 'string', headline: 'string', category: 'string', tags: 'string[]', intent: 'string', embedding: 'vector[384]' } 
        });
        setOramaDb(db);
      }
    } catch (err) { } finally {
      setIsReprocessingAI(false);
      setTimeout(() => setRefreshProgress(null), 3000);
    }
  };

  const handleImportNotes = (importedNotes: Note[]) => {
    setNotes(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const newUniqueNotes = importedNotes.filter(n => !existingIds.has(n.id));
      return [...newUniqueNotes, ...prev];
    });
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setNoteToDelete(null);
  };

  const handleKeyError = () => {
    const updatedKeys = { ...serviceKeys, tasks: undefined, calendar: undefined, expiresAt: undefined };
    setServiceKeys(updatedKeys);
    localStorage.setItem('note_forge_service_keys', JSON.stringify(updatedKeys));
  };

  useEffect(() => {
    if (!oramaDb || !searchQuery.trim()) { setSearchResults(null); return; }
    const runSearch = async () => {
      const queryEmbedding = await getLocalEmbedding(searchQuery);
      try {
        const results = await search(oramaDb, {
            term: searchQuery,
            limit: 20,
            boost: { headline: 2, category: 1.5 },
            ...(queryEmbedding ? { vector: { property: 'embedding', value: queryEmbedding, similarity: 0.6 } } : {})
          });
          setSearchResults(results.hits.map((h: any) => h.id));
      } catch (e) {
          const results = await search(oramaDb, {
            term: searchQuery,
            limit: 20,
            boost: { headline: 2, category: 1.5 }
          });
          setSearchResults(results.hits.map((h: any) => h.id));
      }
    };
    const timer = setTimeout(runSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, oramaDb]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    if (searchResults) {
      return notes
        .filter(n => searchResults.includes(n.id))
        .sort((a, b) => searchResults.indexOf(a.id) - searchResults.indexOf(b.id));
    }
    return notes.filter(n => n.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [notes, searchQuery, searchResults]);

  const sortedNotesByCategory = useMemo(() => {
    return [...notes].sort((a, b) => {
      const catA = (a.category || 'Thoughts').toLowerCase();
      const catB = (b.category || 'Thoughts').toLowerCase();
      if (catA < catB) return -1;
      if (catA > catB) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [notes]);

  const theme = THEMES[modelTier];
  const logoVar = LOGO_VARIATIONS[logoVarIdx];

  const scrollToNote = (id: string) => {
    setShowOverview(false);
    setShowInsights(false);
    setTimeout(() => {
      const el = document.getElementById(`note-${id}`);
      if (el && scrollContainerRef.current) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const scrollToDate = (dateStr: string) => {
    setShowInsights(false);
    const targetNote = notes.find(n => new Date(n.timestamp).toISOString().split('T')[0] === dateStr);
    if (targetNote) {
      scrollToNote(targetNote.id);
    }
  };

  const getFocusModeOverlayColor = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getOverviewTransform = () => {
    if (isSwiping && swipeLockedOn.current === 'overview') {
      if (showOverview) return `translateX(${Math.max(0, swipeOffset)}px)`;
      else return `translateX(calc(100% + ${Math.min(0, swipeOffset)}px))`;
    }
    return showOverview ? 'translateX(0)' : 'translateX(100%)';
  };

  const getBackdropOpacity = () => {
    const maxOpacity = 0.4;
    if (isSwiping) {
      const progress = Math.abs(swipeOffset) / screenWidth.current;
      if (showOverview || showInsights) return Math.max(0, maxOpacity - (progress * maxOpacity));
      else return Math.min(maxOpacity, progress * maxOpacity * 3);
    }
    return (showOverview || showInsights) ? maxOpacity : 0;
  };

  const backgroundBlurClasses = `transition-all duration-400 ${(isFocusMode || showOverview || showInsights || isSwiping || isShareLaunch) ? 'opacity-10 blur-sm pointer-events-none' : 'opacity-100'}`;

  const pullProgress = Math.min(1, pullOffset / 80);
  const pullRotation = pullOffset * 2.5;
  const pullScale = 0.5 + (pullProgress * 0.7);

  return (
    <div 
        ref={scrollContainerRef}
        className="h-dvh flex flex-col transition-colors duration-500 relative overflow-x-hidden overflow-y-auto touch-pan-y no-scrollbar" 
        style={{ backgroundColor: theme.bg }} 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
    >
      <div 
        className={`fixed top-0 left-0 right-0 z-[1000] flex justify-center pointer-events-none transition-opacity duration-300 ${pullOffset > 10 || isRefreshing ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: `translateY(${Math.min(pullOffset - 50, 60)}px)` }}
      >
        <div 
          className="transition-transform duration-300" 
          style={{ transform: `rotate(${pullRotation}deg) scale(${isRefreshing ? 1.4 : pullScale})` }}
        >
           <FidgetStar sizeClass="w-12 h-12" colorClass={isRefreshing ? 'text-[#FFDAD6]' : theme.primaryText} />
        </div>
      </div>

      <ActivityInsights 
        notes={notes} 
        theme={theme} 
        isOpen={showInsights} 
        onClose={() => setShowInsights(false)} 
        isSwiping={isSwiping && swipeLockedOn.current === 'insights'}
        swipeOffset={swipeOffset}
        onDateClick={scrollToDate}
        getFocusModeOverlayColor={getFocusModeOverlayColor}
        backdropOpacity={getBackdropOpacity()}
      />

      <div 
        className={`flex-1 flex flex-col ${isRefreshing ? 'transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]' : 'transition-transform duration-300 ease-out'}`}
        style={{ transform: `translateY(${pullOffset}px)` }}
      >
        <header className={`pt-safe pb-4 px-5 max-w-5xl w-full mx-auto flex items-center justify-between ${backgroundBlurClasses}`}>
          <div className="flex flex-col pt-8">
            <h1 onClick={() => setLogoVarIdx(p => (p + 1) % LOGO_VARIATIONS.length)} className="text-3xl md:text-5xl text-[#E3E2E6] tracking-tight cursor-pointer select-none transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]" style={{ fontVariationSettings: logoVar.fontVariationSettings }}>note-forge</h1>
            <div className={`flex items-center gap-2 ${theme.primaryText} text-[10px] font-bold uppercase tracking-[0.2em] mt-2 opacity-60`}>
               {isIndexing || isReprocessingAI ? (<span className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${theme.primaryBg} animate-ping`}></div>{isReprocessingAI ? 'AI Knowledge Rebuild' : 'Index Initializing'}</span>) : ("INTELLIGENT NOTE TAKING")}
            </div>
          </div>
          <div className="flex items-center gap-4 pt-8">
            {notes.length > 0 && <FidgetStar sizeClass="w-8 h-8" colorClass={geminiError ? 'text-[#FFB4AB]' : theme.primaryText} />}
            <button onClick={() => toggleOverviewProgrammatically(true)} className={`w-12 h-12 rounded-full ${theme.primaryBg} ${theme.onPrimaryText} flex items-center justify-center font-black text-lg shadow-xl transition-all active:scale-90`}>{notes.length}</button>
          </div>
        </header>

        <main className="px-5 max-w-5xl w-full mx-auto flex-1">
          <div className={`mb-10 relative group ${backgroundBlurClasses}`}>
            <div className={`absolute inset-y-0 left-6 flex items-center pointer-events-none ${theme.subtleText} group-focus-within:${theme.primaryText} transition-colors opacity-40`}><span className="material-symbols-rounded">search</span></div>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes..." className={`w-full ${theme.surface} h-16 pl-16 pr-8 rounded-[1.5rem] text-[#E3E2E6] placeholder-[#8E9099] focus:outline-none focus:ring-2 ${theme.focusRing} transition-all shadow-lg border border-white/5`} />
          </div>

          <div className={`transition-all duration-400 ${(showOverview || showInsights || isSwiping) ? 'opacity-10 blur-sm pointer-events-none' : 'opacity-100'}`}>
             <TheForge 
                onSave={handleNoteSave} 
                theme={theme} 
                onFocusChange={setIsFocusMode} 
                initialContent={editContent} 
                initialRagEnabled={editRagEnabled}
                isEditing={!!editingNoteId} 
                onCancelEdit={handleCancelEdit} 
              />
          </div>

          <div className={`mt-10 ${backgroundBlurClasses}`}>
            <div className="flex items-center gap-6 mb-8">
              <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.subtleText} opacity-30`}>{searchQuery ? 'Neural Matching' : 'Recent Collections'}</span>
              <div className="h-[1px] flex-1 bg-white/5"></div>
            </div>
            <div className="masonry-grid">
              {filteredNotes.length > 0 ? filteredNotes.map(note => (
                <div id={`note-${note.id}`} key={note.id} className="anti-alias-item">
                  <NoteCard note={note} onDelete={(id) => setNotes(p => p.filter(n => n.id !== id))} onUpdate={(id, up) => setNotes(p => p.map(n => n.id === id ? {...n, ...up} : n))} onEdit={handleEditNote} onKeyError={handleKeyError} theme={theme} serviceKeys={serviceKeys} />
                </div>
              )) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
                  <span className="material-symbols-rounded text-6xl mb-4">note_stack</span>
                  <p className="text-sm font-bold tracking-widest uppercase">No Records Found</p>
                </div>
              )}
            </div>
          </div>
          
          <div className={`pb-safe ${backgroundBlurClasses}`}>
            <ContextManager modelTier={modelTier} onTierChange={setModelTier} theme={theme} />
            <KeyVault theme={theme} onKeysUpdated={setServiceKeys} />
            <div className="flex flex-row items-stretch justify-center gap-3 mt-8 mb-12 w-full pb-8">
              <DataTransfer notes={notes} onImport={handleImportNotes} theme={theme} className="flex-[1.5]" />
              {notes.length > 0 && (
                <div className={`p-1 flex-1 flex rounded-full border border-white/5 ${theme.surface} shadow-lg transition-colors duration-500 h-12`}>
                  <button onClick={handleRefreshMetadata} disabled={isReprocessingAI} className={`w-full inline-flex items-center justify-center gap-2 h-full rounded-full ${theme.primaryBg} ${theme.onPrimaryText} transition-all duration-500 ${isReprocessingAI ? 'cursor-wait opacity-80' : 'active:scale-95 hover:brightness-110'} text-[10px] font-black uppercase tracking-[0.2em] shadow-md`}>
                    <span className={`material-symbols-rounded text-lg`}>auto_awesome</span>
                    <span>{isReprocessingAI ? `${Math.round((refreshProgress?.current || 0) / (refreshProgress?.total || 1) * 100)}%` : 'Refresh AI'}</span>
                  </button>
                </div>
              )}
              <button onClick={() => window.location.reload()} className={`w-12 h-12 rounded-full border border-white/5 ${theme.surface} flex items-center justify-center ${theme.primaryText} shadow-lg active:scale-90 transition-all hover:bg-white/5`} title="Reload Page"><span className="material-symbols-rounded text-xl">refresh</span></button>
            </div>
          </div>
        </main>
      </div>

      <div className={`fixed inset-0 z-[9999] overflow-y-auto anti-alias-container backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] touch-pan-y ${isSwiping && swipeLockedOn.current === 'overview' ? 'duration-0' : ''}`} style={{ backgroundColor: getFocusModeOverlayColor(theme.bg, getBackdropOpacity()), transform: getOverviewTransform(), visibility: (showOverview || (isSwiping && swipeLockedOn.current === 'overview')) ? 'visible' : 'hidden' }}>
        <div className="max-w-5xl mx-auto px-5 w-full min-h-full flex flex-col pointer-events-auto pt-safe pb-safe">
          <div className="pt-10 pb-6 flex items-center justify-between flex-shrink-0">
            <div className="flex flex-col">
              <h1 className="text-3xl md:text-5xl text-[#E3E2E6] tracking-tight transition-all duration-700" style={{ fontVariationSettings: '"wght" 600, "wdth" 100, "slnt" 0' }}>grid-overview</h1>
              <div className={`flex items-center gap-2 ${theme.primaryText} text-[10px] font-bold uppercase tracking-[0.2em] mt-2 opacity-60`}>{notes.length} RECORDS SORTED BY CATEGORY</div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => toggleOverviewProgrammatically(false)} className={`w-12 h-12 rounded-full ${theme.surface} flex items-center justify-center text-[#E3E2E6] shadow-xl active:scale-90 border border-white/10 hover:bg-white/10 transition-all`}><span className="material-symbols-rounded text-2xl">close</span></button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-24 mt-4">
            {sortedNotesByCategory.map((note, index) => {
              const style = getCategoryStyle(note.category);
              const shouldAnimate = showOverview && !wasSwipedOpen && !isSwiping;
              return (
                <div key={note.id} className={`${theme.surface} p-5 rounded-[1.5rem] border border-white/10 transition-all flex flex-col gap-2 h-[180px] shadow-2xl anti-alias-item group relative overflow-hidden`} style={{ animation: shouldAnimate ? `staggered-materialize 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.015}s both` : 'none' }}>
                  <div className="flex justify-between items-center flex-shrink-0 relative z-10">
                    <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-widest shadow-sm" style={{ backgroundColor: style.bg, color: style.text }}>{note.category}</span>
                        {note.ragEnabled && <span className="material-symbols-rounded text-[10px] text-white/40">database</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleEditNote(note); }} className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-black/20 transition-all"><span className="material-symbols-rounded text-lg">edit</span></button>
                      <button onClick={(e) => { e.stopPropagation(); setNoteToDelete(note); }} className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-black/20 transition-all"><span className="material-symbols-rounded text-lg">delete</span></button>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#E3E2E6] leading-snug line-clamp-4 tracking-tight relative z-10" style={{ fontVariationSettings: '"wght" 600' }}>{note.headline}</h3>
                  <div className="mt-auto flex justify-between items-center relative z-10">
                     <span className="text-[9px] font-bold uppercase tracking-tighter opacity-40 text-[#E3E2E6]">{new Date(note.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isShareLaunch && (
        <div className={`fixed inset-0 z-[20000] flex flex-col items-center justify-center p-8 transition-all duration-700 ${shareStatus === 'closing' ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'}`} style={{ backgroundColor: theme.bg }}>
            <div className="flex flex-col items-center max-w-sm w-full text-center">
                <FidgetStar sizeClass="w-32 h-32 mb-12" colorClass={shareStatus === 'success' ? '#C1CC94' : theme.primaryText} />
                <h2 className="text-3xl font-bold text-[#E3E2E6] mb-4 tracking-tight">
                  {shareStatus === 'active' ? 'Neural Forging' : 'Forging Complete'}
                </h2>
                <p className={`${theme.subtleText} text-sm leading-relaxed opacity-70`}>
                  {shareStatus === 'active' 
                    ? 'Capturing shared content into your intelligent collections...' 
                    : 'Collection updated. Background engines initialized.'}
                </p>
                <div className="mt-10 flex items-center gap-2">
                    <div className={`h-1 rounded-full transition-all duration-700 ${shareStatus === 'success' ? 'w-24 bg-[#C1CC94]' : 'w-12 bg-white/20 animate-pulse'}`}></div>
                </div>
            </div>
        </div>
      )}

      {noteToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300 overflow-hidden">
            <div className="bg-[#601410] w-full max-sm rounded-[2.5rem] p-8 shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-[#8C1D18] animate-in zoom-in-95 duration-300 relative">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#3F1111] flex items-center justify-center mb-6 text-[#FFB4AB]"><span className="material-symbols-rounded text-3xl">delete</span></div>
                    <h4 className="text-2xl font-bold text-[#FFFFFF] mb-2 tracking-tight">Purge Entry?</h4>
                    <p className="text-[#FFDAD6] mb-8 leading-relaxed px-4 opacity-90">"{noteToDelete.headline}" will be permanently removed.</p>
                    <div className="flex flex-col w-full gap-3">
                        <button onClick={() => deleteNote(noteToDelete.id)} className="w-full py-4 rounded-full bg-[#B3261E] text-[#FFB4AB] font-bold uppercase tracking-widest text-xs hover:bg-[#FFB4AB] hover:text-[#601410] active:scale-95 transition-all shadow-lg">Confirm Purge</button>
                        <button onClick={() => setNoteToDelete(null)} className="w-full py-4 rounded-full bg-transparent text-[#FFDAD6] font-bold uppercase tracking-widest text-xs hover:bg-black/20 active:scale-95 transition-all">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;