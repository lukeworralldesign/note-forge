import { HERO_COLORS } from './resources/colors';

export interface Note {
  id: string;
  content: string;
  originalContent?: string;
  timestamp: number;
  aiStatus: 'idle' | 'processing' | 'completed' | 'error';
  category: string;
  headline: string;
  tags: string[];
  embedding?: number[];
  ragEnabled: boolean; // New property to track if context was used
}

export interface AIReponse {
  category: string;
  headline: string;
  tags: string[];
  embedding?: number[];
}

export interface ServiceKeys {
  tasks?: string; 
  gemini?: string;
  clientId?: string;
}

export type ModelTier = 'flash' | 'pro';

export interface ThemeColors {
  key: ModelTier;
  bg: string;
  surface: string;
  surfaceHover: string;
  surfaceBorder: string;
  primaryText: string;
  primaryBg: string;
  onPrimaryText: string;
  secondaryBg: string;
  secondaryHover: string;
  secondaryText: string;
  accentHex: string;
  focusRing: string;
  border: string;
  subtleText: string;
}

interface CategoryStyle {
  bg: string;
  text: string;
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  thoughts: { bg: HERO_COLORS.LAVENDER, text: HERO_COLORS.CHARCOAL },
  ideas: { bg: HERO_COLORS.ELECTRIC_BLUE, text: HERO_COLORS.CHARCOAL },
  reminders: { bg: HERO_COLORS.BRIGHT_YELLOW, text: HERO_COLORS.CHARCOAL },
  coding: { bg: HERO_COLORS.MINT, text: HERO_COLORS.CHARCOAL },
  projects: { bg: HERO_COLORS.PURE_ORANGE, text: HERO_COLORS.CHARCOAL },
  lists: { bg: HERO_COLORS.PERIWINKLE, text: HERO_COLORS.CHARCOAL },
  research: { bg: HERO_COLORS.CYAN, text: HERO_COLORS.CHARCOAL },
  personal: { bg: HERO_COLORS.BRIGHT_PINK, text: HERO_COLORS.CHARCOAL },
  default: { bg: HERO_COLORS.SILVER, text: HERO_COLORS.CHARCOAL }
};

export const getCategoryStyle = (category: string = 'default'): CategoryStyle => {
  const cat = category.toLowerCase();
  if (cat === 'list') return CATEGORY_STYLES.lists;
  if (cat === 'thought') return CATEGORY_STYLES.thoughts;
  if (cat === 'reminder') return CATEGORY_STYLES.reminders;
  if (cat === 'project') return CATEGORY_STYLES.projects;
  if (cat === 'idea') return CATEGORY_STYLES.ideas;
  
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES.default;
};