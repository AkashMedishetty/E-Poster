import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportAsJson,
  exportAsCsv,
  parseCsv,
  triggerDownload,
  InteractionExport,
  CsvRow,
} from './dataExporter';
import type { PosterInteractions } from './interactionStore';

function makePoster(overrides: Partial<PosterInteractions> = {}): PosterInteractions {
  return {
    abstractId: 'ABS-0001',
    reactions: {},
    comments: [],
    likes: 0,
    ...overrides,
  };
}

describe('exportAsJson', () => {
  it('produces valid JSON with correct structure', () => {
    const interactions = [makePoster({ abstractId: 'ABS-0001', likes: 3 })];
    const json = exportAsJson(interactions);
    const parsed: InteractionExport = JSON.parse(json);

    expect(parsed.totalPosters).toBe(1);
    expect(parsed.posters).toHaveLength(1);
    expect(parsed.posters[0].abstractId).toBe('ABS-0001');
    expect(parsed.posters[0].likes).toBe(3);
    expect(parsed.exportedAt).toBeTruthy();
    // exportedAt should be a valid ISO date
    expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
  });

  it('handles empty interactions array', () => {
    const json = exportAsJson([]);
    const parsed: InteractionExport = JSON.parse(json);
    expect(parsed.totalPosters).toBe(0);
    expect(parsed.posters).toEqual([]);
  });

  it('preserves reactions, comments, and likes', () => {
    const interactions = [
      makePoster({
        abstractId: 'ABS-0002',
        reactions: { '👍': 5, '❤️': 3 },
        comments: [{ text: 'Great work!', timestamp: 1700000000000 }],
        likes: 12,
      }),
    ];
    const json = exportAsJson(interactions);
    const parsed: InteractionExport = JSON.parse(json);
    const poster = parsed.posters[0];

    expect(poster.reactions['👍']).toBe(5);
    expect(poster.reactions['❤️']).toBe(3);
    expect(poster.comments[0].text).toBe('Great work!');
    expect(poster.comments[0].timestamp).toBe(1700000000000);
    expect(poster.likes).toBe(12);
  });
});

describe('exportAsCsv', () => {
  it('produces header row', () => {
    const csv = exportAsCsv([]);
    expect(csv).toBe('abstract_id,type,emoji,count,comment_text,timestamp,likes');
  });

  it('generates reaction rows', () => {
    const csv = exportAsCsv([
      makePoster({ abstractId: 'ABS-0002', reactions: { '👍': 5 } }),
    ]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('ABS-0002,reaction,👍,5,,,');
  });

  it('generates comment rows', () => {
    const csv = exportAsCsv([
      makePoster({
        abstractId: 'ABS-0002',
        comments: [{ text: 'Great work!', timestamp: 1700000000000 }],
      }),
    ]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('ABS-0002,comment,,,"Great work!",1700000000000,');
  });

  it('generates likes row when likes > 0', () => {
    const csv = exportAsCsv([makePoster({ abstractId: 'ABS-0002', likes: 12 })]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('ABS-0002,likes,,,,,12');
  });

  it('omits likes row when likes is 0', () => {
    const csv = exportAsCsv([makePoster({ abstractId: 'ABS-0002', likes: 0 })]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // header only
  });

  it('handles comment text with quotes', () => {
    const csv = exportAsCsv([
      makePoster({
        comments: [{ text: 'Said "hello"', timestamp: 1700000000000 }],
      }),
    ]);
    const rows = parseCsv(csv);
    expect(rows[0].comment_text).toBe('Said "hello"');
  });
});

describe('parseCsv', () => {
  it('returns empty array for header-only CSV', () => {
    const rows = parseCsv('abstract_id,type,emoji,count,comment_text,timestamp,likes');
    expect(rows).toEqual([]);
  });

  it('parses reaction rows', () => {
    const csv = 'abstract_id,type,emoji,count,comment_text,timestamp,likes\nABS-0002,reaction,👍,5,,,';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].abstract_id).toBe('ABS-0002');
    expect(rows[0].type).toBe('reaction');
    expect(rows[0].emoji).toBe('👍');
    expect(rows[0].count).toBe('5');
  });

  it('parses comment rows with quoted text', () => {
    const csv =
      'abstract_id,type,emoji,count,comment_text,timestamp,likes\nABS-0002,comment,,,"Great work!",1700000000000,';
    const rows = parseCsv(csv);
    expect(rows[0].comment_text).toBe('Great work!');
    expect(rows[0].timestamp).toBe('1700000000000');
  });

  it('parses likes rows', () => {
    const csv =
      'abstract_id,type,emoji,count,comment_text,timestamp,likes\nABS-0002,likes,,,,,12';
    const rows = parseCsv(csv);
    expect(rows[0].type).toBe('likes');
    expect(rows[0].likes).toBe('12');
  });

  it('round-trips through exportAsCsv and parseCsv', () => {
    const interactions = [
      makePoster({
        abstractId: 'ABS-0002',
        reactions: { '👍': 5, '❤️': 3 },
        comments: [{ text: 'Great work!', timestamp: 1700000000000 }],
        likes: 12,
      }),
    ];
    const csv = exportAsCsv(interactions);
    const rows = parseCsv(csv);

    // 2 reactions + 1 comment + 1 likes = 4 rows
    expect(rows).toHaveLength(4);

    const reactionRows = rows.filter((r) => r.type === 'reaction');
    expect(reactionRows).toHaveLength(2);

    const commentRows = rows.filter((r) => r.type === 'comment');
    expect(commentRows).toHaveLength(1);
    expect(commentRows[0].comment_text).toBe('Great work!');

    const likesRows = rows.filter((r) => r.type === 'likes');
    expect(likesRows).toHaveLength(1);
    expect(likesRows[0].likes).toBe('12');
  });
});

describe('triggerDownload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob URL, clicks a link, and cleans up', () => {
    const mockUrl = 'blob:http://localhost/fake-url';
    const createObjectURL = vi.fn().mockReturnValue(mockUrl);
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      // Spy on click when the anchor is appended
      (node as HTMLAnchorElement).click = clickSpy;
      return node;
    });
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    triggerDownload('test content', 'export.csv', 'text/csv');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
