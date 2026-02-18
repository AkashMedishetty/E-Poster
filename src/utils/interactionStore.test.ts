import { describe, it, expect, beforeEach } from 'vitest';
import {
  getInteractions,
  addReaction,
  addComment,
  addLike,
  getAllInteractions,
} from './interactionStore';

describe('interactionStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getInteractions', () => {
    it('returns default interactions for unknown poster', () => {
      const result = getInteractions('ABS-1');
      expect(result).toEqual({
        abstractId: 'ABS-1',
        reactions: {},
        comments: [],
        likes: 0,
      });
    });

    it('returns comments sorted reverse chronologically', () => {
      // Manually store comments out of order
      const data = {
        abstractId: 'ABS-1',
        reactions: {},
        comments: [
          { text: 'oldest', timestamp: 1000 },
          { text: 'newest', timestamp: 3000 },
          { text: 'middle', timestamp: 2000 },
        ],
        likes: 0,
      };
      localStorage.setItem(
        'eposter-interactions-ABS-1',
        JSON.stringify(data)
      );

      const result = getInteractions('ABS-1');
      expect(result.comments[0].text).toBe('newest');
      expect(result.comments[1].text).toBe('middle');
      expect(result.comments[2].text).toBe('oldest');
    });

    it('handles corrupted JSON gracefully', () => {
      localStorage.setItem('eposter-interactions-ABS-1', '{bad json');
      const result = getInteractions('ABS-1');
      expect(result).toEqual({
        abstractId: 'ABS-1',
        reactions: {},
        comments: [],
        likes: 0,
      });
    });
  });

  describe('addReaction', () => {
    it('increments reaction count for an emoji', () => {
      addReaction('ABS-1', '👍');
      const result = getInteractions('ABS-1');
      expect(result.reactions['👍']).toBe(1);
    });

    it('increments existing reaction count', () => {
      addReaction('ABS-1', '❤️');
      addReaction('ABS-1', '❤️');
      addReaction('ABS-1', '❤️');
      const result = getInteractions('ABS-1');
      expect(result.reactions['❤️']).toBe(3);
    });

    it('tracks multiple emojis independently', () => {
      addReaction('ABS-1', '👍');
      addReaction('ABS-1', '🔥');
      addReaction('ABS-1', '👍');
      const result = getInteractions('ABS-1');
      expect(result.reactions['👍']).toBe(2);
      expect(result.reactions['🔥']).toBe(1);
    });
  });

  describe('addComment', () => {
    it('adds a valid comment with timestamp', () => {
      const before = Date.now();
      const added = addComment('ABS-1', 'Great poster!');
      const after = Date.now();

      expect(added).toBe(true);
      const result = getInteractions('ABS-1');
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].text).toBe('Great poster!');
      expect(result.comments[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(result.comments[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('rejects empty string', () => {
      const added = addComment('ABS-1', '');
      expect(added).toBe(false);
      expect(getInteractions('ABS-1').comments).toHaveLength(0);
    });

    it('rejects whitespace-only string', () => {
      expect(addComment('ABS-1', '   ')).toBe(false);
      expect(addComment('ABS-1', '\t\n')).toBe(false);
      expect(addComment('ABS-1', '  \t  \n  ')).toBe(false);
      expect(getInteractions('ABS-1').comments).toHaveLength(0);
    });

    it('stores multiple comments', () => {
      addComment('ABS-1', 'First');
      addComment('ABS-1', 'Second');
      const result = getInteractions('ABS-1');
      expect(result.comments).toHaveLength(2);
    });
  });

  describe('addLike', () => {
    it('increments like count', () => {
      addLike('ABS-1');
      expect(getInteractions('ABS-1').likes).toBe(1);
    });

    it('increments like count multiple times', () => {
      addLike('ABS-1');
      addLike('ABS-1');
      addLike('ABS-1');
      expect(getInteractions('ABS-1').likes).toBe(3);
    });
  });

  describe('getAllInteractions', () => {
    it('returns empty array when no interactions exist', () => {
      expect(getAllInteractions()).toEqual([]);
    });

    it('returns all stored interactions', () => {
      addLike('ABS-1');
      addReaction('ABS-2', '👍');
      addComment('ABS-3', 'Nice');

      const all = getAllInteractions();
      expect(all).toHaveLength(3);
      const ids = all.map((i) => i.abstractId).sort();
      expect(ids).toEqual(['ABS-1', 'ABS-2', 'ABS-3']);
    });

    it('ignores non-interaction localStorage keys', () => {
      localStorage.setItem('other-key', 'value');
      addLike('ABS-1');

      const all = getAllInteractions();
      expect(all).toHaveLength(1);
      expect(all[0].abstractId).toBe('ABS-1');
    });
  });

  describe('isolation between posters', () => {
    it('interactions on one poster do not affect another', () => {
      addLike('ABS-1');
      addReaction('ABS-1', '👍');
      addComment('ABS-1', 'Hello');

      const poster2 = getInteractions('ABS-2');
      expect(poster2.likes).toBe(0);
      expect(poster2.reactions).toEqual({});
      expect(poster2.comments).toEqual([]);
    });
  });
});
