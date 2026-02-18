/**
 * InteractionStore — manages anonymous reactions, comments, and likes
 * in localStorage for offline poster interactions.
 */

export interface Comment {
  text: string;
  timestamp: number; // Unix timestamp ms
}

export interface PosterInteractions {
  abstractId: string;
  reactions: Record<string, number>; // emoji → count
  comments: Comment[];
  likes: number;
}

const KEY_PREFIX = 'eposter-interactions-';

function storageKey(abstractId: string): string {
  return `${KEY_PREFIX}${abstractId}`;
}

function defaultInteractions(abstractId: string): PosterInteractions {
  return {
    abstractId,
    reactions: {},
    comments: [],
    likes: 0,
  };
}

function readFromStorage(abstractId: string): PosterInteractions {
  const raw = localStorage.getItem(storageKey(abstractId));
  if (!raw) return defaultInteractions(abstractId);
  try {
    const parsed = JSON.parse(raw) as PosterInteractions;
    // Ensure abstractId is set correctly
    parsed.abstractId = abstractId;
    return parsed;
  } catch {
    return defaultInteractions(abstractId);
  }
}

function writeToStorage(interactions: PosterInteractions): void {
  localStorage.setItem(
    storageKey(interactions.abstractId),
    JSON.stringify(interactions)
  );
}

/**
 * Get interactions for a specific poster.
 * Comments are returned sorted in reverse chronological order (newest first).
 */
export function getInteractions(abstractId: string): PosterInteractions {
  const data = readFromStorage(abstractId);
  // Sort comments reverse chronologically
  data.comments.sort((a, b) => b.timestamp - a.timestamp);
  return data;
}

/**
 * Add a reaction (emoji) to a poster. Increments the count for that emoji.
 */
export function addReaction(abstractId: string, emoji: string): void {
  const data = readFromStorage(abstractId);
  data.reactions[emoji] = (data.reactions[emoji] || 0) + 1;
  writeToStorage(data);
}

/**
 * Add a comment to a poster. Rejects whitespace-only text.
 * Returns true if the comment was added, false if rejected.
 */
export function addComment(abstractId: string, text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }
  const data = readFromStorage(abstractId);
  data.comments.push({ text, timestamp: Date.now() });
  writeToStorage(data);
  return true;
}

/**
 * Add a like to a poster. Increments the like count.
 */
export function addLike(abstractId: string): void {
  const data = readFromStorage(abstractId);
  data.likes += 1;
  writeToStorage(data);
}

/**
 * Get all interactions across all posters.
 * Iterates localStorage keys with the interaction prefix.
 */
export function getAllInteractions(): PosterInteractions[] {
  const results: PosterInteractions[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX)) {
      const abstractId = key.slice(KEY_PREFIX.length);
      results.push(getInteractions(abstractId));
    }
  }
  return results;
}
