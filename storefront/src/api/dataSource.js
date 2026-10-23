// Milestone 5 — the one place that reads VITE_DATA_SOURCE. Everything
// else that needs to know which backend is active imports DATA_SOURCE/
// isMarketplace from here rather than reading import.meta.env directly,
// so there's exactly one definition of "which mode are we in" to keep
// consistent.
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === 'marketplace' ? 'marketplace' : 'pos';
export const isMarketplace = DATA_SOURCE === 'marketplace';

export const MARKETPLACE_API_URL = import.meta.env.VITE_MARKETPLACE_API_URL || 'http://localhost:5002';
export const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL || '';
