export const ALCOHOL_TYPES = [
  { key: 'gin',            label: 'Gin',            labelHe: "ג'ין",       emoji: '🌿', color: '#10b981' },
  { key: 'whiskey',        label: 'Whiskey',        labelHe: 'וויסקי',     emoji: '🥃', color: '#f59e0b' },
  { key: 'bourbon',        label: 'Bourbon',        labelHe: 'בורבון',     emoji: '🥃', color: '#d97706' },
  { key: 'vodka',          label: 'Vodka',          labelHe: 'וודקה',      emoji: '🫙', color: '#60a5fa' },
  { key: 'rum',            label: 'Rum',            labelHe: 'רום',        emoji: '🌴', color: '#fb923c' },
  { key: 'tequila',        label: 'Tequila',        labelHe: 'טקילה',      emoji: '🌵', color: '#a3e635' },
  { key: 'mezcal',         label: 'Mezcal',         labelHe: 'מזקל',       emoji: '🌿', color: '#86efac' },
  { key: 'brandy',         label: 'Brandy',         labelHe: 'ברנדי',      emoji: '🍷', color: '#b45309' },
  { key: 'campari',        label: 'Campari',        labelHe: 'קמפרי',      emoji: '🍊', color: '#ef4444' },
  { key: 'vermouth',       label: 'Vermouth',       labelHe: 'ורמוט',      emoji: '🫗', color: '#c084fc' },
  { key: 'coffee_liqueur', label: 'Coffee Liqueur', labelHe: 'ליקר קפה',   emoji: '☕', color: '#78350f' },
  { key: 'coconut',        label: 'Coconut',        labelHe: 'קוקוס',      emoji: '🥥', color: '#fde68a' },
  { key: 'wine',           label: 'Wine',           labelHe: 'יין',        emoji: '🍷', color: '#9f1239' },
  { key: 'beer',           label: 'Beer',           labelHe: 'בירה',       emoji: '🍺', color: '#fbbf24' },
  { key: 'liqueur',        label: 'Liqueur',        labelHe: 'ליקר',       emoji: '🍬', color: '#e879f9' },
  { key: 'other',          label: 'Other',          labelHe: 'אחר',        emoji: '🍸', color: '#94a3b8' },
];

export const getAlcohol = (key) =>
  ALCOHOL_TYPES.find(a => a.key === key) || { key, label: key, labelHe: key, emoji: '🍸', color: '#94a3b8' };

export const getAlcoholLabel = (key, lang) => {
  const a = getAlcohol(key);
  return lang === 'he' ? (a.labelHe || a.label) : a.label;
};

export const avatarGradients = [
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#ec4899,#f59e0b)',
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
];

export const getAvatarGradient = (id) => avatarGradients[(id - 1) % avatarGradients.length];

// Localized relative time — pass lang from useLang()
export const timeAgo = (dateStr, lang = 'en') => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (lang === 'he') {
    if (diff < 60)      return 'עכשיו';
    if (diff < 3600)    return `לפני ${Math.floor(diff / 60)} דק'`;
    if (diff < 86400)   return `לפני ${Math.floor(diff / 3600)} שע'`;
    if (diff < 604800)  return `לפני ${Math.floor(diff / 86400)} ימים`;
    return new Date(dateStr).toLocaleDateString('he-IL');
  }
  if (diff < 60)      return 'just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

export const difficultyColor = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };

// Prepend API base URL to relative image paths.
// Set VITE_API_URL env var in production; empty string = same origin.
// Absolute URLs (http(s)://...) are returned unchanged so external image hosts work.
export const API_BASE = import.meta.env.VITE_API_URL || '';
export const getImageUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
};
