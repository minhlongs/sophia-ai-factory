const RECENT_KEY = 'sophia.cmdK.recent';
const MAX_RECENT = 5;

export function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function saveRecent(id: string) {
  try {
    const prev = loadRecent().filter((r) => r !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}
