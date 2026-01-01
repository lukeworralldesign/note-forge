import { HERO_COLORS } from './resources/colors';

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  description?: string;
}

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
  ragEnabled: boolean;
  intent?: 'task' | 'reference' | 'ephemeral';
  calendarSync?: boolean;
  eventDetails?: CalendarEvent;
}

export interface AIReponse {
  category: string;
  headline: string;
  tags: string[];
  embedding?: number[];
  intent?: 'task' | 'reference' | 'ephemeral';
  calendarSync?: boolean;
  eventDetails?: CalendarEvent;
}

export interface ServiceKeys {
  tasks?: string; 
  gemini?: string;
  clientId?: string;
  calendar?: string;
  expiresAt?: number;
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
  idea: { bg: '#D9FFCA', text: '#0F2F00' },
  reference: { bg: '#FFD8E4', text: '#3E001D' },
  list: { bg: '#D3E3FD', text: '#041E49' },
  project: { bg: '#FFDCC1', text: '#2E1500' },
  goal: { bg: '#FFEFA4', text: '#241A00' },
  todo: { bg: '#FFDAD6', text: '#410002' },
  urgent: { bg: '#FFD7F2', text: '#3D0024' },
  work: { bg: '#E0E0FF', text: '#000F5D' },
  personal: { bg: '#BCF0DF', text: '#00201A' },
  finance: { bg: '#C4EED0', text: '#00210E' },
  health: { bg: '#FFECF0', text: '#3E001D' },
  tech: { bg: '#A6EEFF', text: '#001F25' },
  journal: { bg: '#EADDFF', text: '#21005D' },
  meeting: { bg: '#F3DAFF', text: '#2E004E' },
  travel: { bg: '#C3E7FF', text: '#001E2F' },
  recipe: { bg: '#FFDCC1', text: '#331200' },
  code: { bg: '#DDE3EA', text: '#1A1C1E' },
  quote: { bg: '#EAE1D9', text: '#1E1B16' },
  review: { bg: '#C4EED0', text: '#00210E' },
  archive: { bg: '#E2E2E2', text: '#1B1B1B' },
  default: { bg: '#E2E2E2', text: '#1B1B1B' }
};

export const getCategoryStyle = (category: string = 'default'): CategoryStyle => {
  const cat = category.toLowerCase().trim();
  
  // Direct match
  if (CATEGORY_STYLES[cat]) return CATEGORY_STYLES[cat];
  
  // Pluralization / Variation handling
  if (cat === 'ideas') return CATEGORY_STYLES.idea;
  if (cat === 'lists' || cat === 'ephemeral') return CATEGORY_STYLES.list;
  if (cat === 'thoughts' || cat === 'thought') return CATEGORY_STYLES.journal;
  if (cat === 'reminders' || cat === 'reminder' || cat === 'tasks') return CATEGORY_STYLES.todo;
  if (cat === 'projects') return CATEGORY_STYLES.project;
  if (cat === 'coding') return CATEGORY_STYLES.code;
  if (cat === 'finances') return CATEGORY_STYLES.finance;
  if (cat === 'research') return CATEGORY_STYLES.reference;
  
  return CATEGORY_STYLES.default;
};