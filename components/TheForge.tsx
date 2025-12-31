
import React, { useState, useRef, useEffect } from 'react';
import { ThemeColors } from '../types';

interface TheForgeProps {
  onSave: (content: string, ragEnabled: boolean) => void;
  theme: ThemeColors;
  onFocusChange?: (focused: boolean) => void;
  initialContent?: string;
  isEditing?: boolean;
  initialRagEnabled?: boolean;
  onCancelEdit?: () => void;
}

const TheForge: React.FC<TheForgeProps> = ({ 
    onSave, 
    theme, 
    onFocusChange, 
    initialContent = '', 
    isEditing = false,
    initialRagEnabled = false,
    onCancelEdit 
}) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(initialRagEnabled);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(initialContent);
    setRagEnabled(initialRagEnabled);
    if (isEditing && initialContent && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(initialContent.length, initialContent.length);
    }
  }, [initialContent, isEditing, initialRagEnabled]);

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocusChange) onFocusChange(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onFocusChange) onFocusChange(false);
  };

  const handleSubmit = () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    
    onSave(trimmedContent, ragEnabled);
    
    if (!isEditing) {
      setContent('');
    }
  };

  const handleCancel = () => {
    if (onCancelEdit) {
      onCancelEdit();
      setContent('');
      setRagEnabled(false);
    }
  };

  const ringColor = isEditing ? 'ring-[#FFB74D]' : theme.focusRing;
  const buttonBg = isEditing ? 'bg-[#FFB74D]' : theme.primaryBg;
  const buttonText = isEditing ? 'text-[#4E342E]' : theme.onPrimaryText;
  
  // Dark cocoa/orange background for edit mode
  const surfaceColor = isEditing ? 'bg-[#261914]' : theme.surface;

  // Tier-specific active colors
  const activeBg = theme.key === 'pro' ? 'bg-[#C2E7FF]' : 'bg-[#C1CC94]';
  const activeText = theme.key === 'pro' ? 'text-[#003258]' : 'text-[#191A12]';
  
  // Tier-specific inactive background colors
  // Flash OFF: #22241A (Dark Olive)
  // Pro OFF: #13161A (Deep Charcoal/Navy)
  const inactiveBg = theme.key === 'pro' ? 'bg-[#13161A]' : 'bg-[#22241A]';
  const inactiveText = theme.key === 'pro' ? 'text-[#C3C7CF]' : 'text-[#C4C7C5]';

  const chipBg = ragEnabled ? activeBg : inactiveBg;
  const chipTextColor = ragEnabled ? activeText : inactiveText;

  return (
    <div className={`w-full mb-8 transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform ${isFocused ? 'scale-[1.02] -translate-y-1' : 'scale-100 translate-y-0'}`}>
      <div 
        className={`
            flex flex-col overflow-hidden
            ${surfaceColor}
            rounded-[2.5rem] 
            transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
            ${isFocused || isEditing ? `ring-2 ${ringColor} shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)]` : 'shadow-lg shadow-black/10'}
        `}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isEditing ? "Modifying entry..." : "New note..."}
          enterKeyHint="send"
          className="w-full h-48 md:h-64 bg-transparent px-10 pt-10 pb-4 text-xl md:text-2xl text-[#FDFDFF] placeholder-[#8E9099] focus:outline-none resize-none leading-relaxed transition-all duration-500"
          style={{ fontVariationSettings: '"wght" 450' }}
        />

        {/* Footer Container: px-10 matches the 2.5rem radius (40px) for optical alignment */}
        <div className="flex items-center justify-between px-10 pb-7">
            {/* Flat M3 Push Toggle Chip (No Outline) - Added translate-y-1 to sit lower in the curve */}
            <button 
              onClick={() => setRagEnabled(!ragEnabled)}
              className={`
                flex items-center gap-2.5 px-4 h-8 rounded-full cursor-pointer transition-all duration-300 translate-y-1
                ${chipBg} hover:brightness-110 active:scale-95 select-none shadow-sm
              `}
            >
                {/* Leading Icon */}
                <span className={`material-symbols-rounded text-base transition-colors duration-300 ${chipTextColor}`}>
                    {ragEnabled ? 'database' : 'database_off'}
                </span>

                <span className={`text-[9px] font-black uppercase tracking-[0.2em] leading-none transition-colors duration-300 ${chipTextColor}`}>
                    RAG
                </span>
            </button>

            <div className="flex items-center gap-6">
                 {isEditing && (
                     <button 
                        onClick={handleCancel}
                        className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFB4AB] hover:bg-[#3F1111] px-4 py-2 rounded-full transition-colors translate-y-1"
                     >
                         Cancel
                     </button>
                 )}

                <button
                    onClick={handleSubmit}
                    disabled={!content.trim()}
                    className={`
                        flex items-center justify-center
                        h-14 w-14 rounded-[20px]
                        transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                        ${content.trim() 
                            ? `${buttonBg} ${buttonText} shadow-xl hover:shadow-2xl hover:scale-110 active:scale-90` 
                            : 'bg-black/20 text-[#444746] cursor-not-allowed'}
                    `}
                >
                    <span className="material-symbols-rounded text-2xl">
                        {isEditing ? 'save' : 'send'}
                    </span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TheForge;
