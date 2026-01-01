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
  idea: { bg: '#B7F397', text: '#215107' },
  reference: { bg: '#FFB0C8', text: '#650B33' },
  list: { bg: '#A8C7FA', text: '#00315F' },
  project: { bg: '#FFDCC1', text: '#2E1500' },
  goal: { bg: '#E2C54B', text: '#3A3000' },
  todo: { bg: '#FFB4AB', text: '#690005' },
  urgent: { bg: '#FFB0CD', text: '#640030' },
  work: { bg: '#BAC3FF', text: '#001A4C' },
  personal: { bg: '#20E3B2', text: '#00382C' },
  finance: { bg: '#6DD58C', text: '#00391C' },
  health: { bg: '#FFD9E2', text: '#5C1126' },
  tech: { bg: '#4FD8EB', text: '#00363D' },
  journal: { bg: '#D0BCFF', text: '#381E72' },
  meeting: { bg: '#EDB1FF', text: '#54006F' },
  travel: { bg: '#D1E4FF', text: '#00315D' },
  recipe: { bg: '#FFB784', text: '#4E2600' },
  code: { bg: '#BCC7D9', text: '#273141' },
  quote: { bg: '#EAE1D9', text: '#1E1B16' },
  review: { bg: '#98F1BF', text: '#003922' },
  archive: { bg: '#C4C7C5', text: '#2E3130' },
  default: { bg: '#C4C7C5', text: '#2E3130' }
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