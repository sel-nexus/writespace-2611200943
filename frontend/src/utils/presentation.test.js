/** Verify deterministic display boundaries for local writing. */
import { describe, expect, it } from 'vitest';
import { excerpt, formatDate, newestFirst } from './presentation.js';

describe('presentation', () => {
  it('formats English dates with padded days and consistent UTC', () => {
    expect(formatDate('2026-06-01T12:30:00Z')).toBe('Jun 01, 2026');
    expect(formatDate('2024-02-29')).toBe('Feb 29, 2024');
  });
  it.each(['invalid', '', null, undefined, {}, 0])('safely formats invalid timestamp %s', (value) => {
    expect(formatDate(value)).toBe('Date unavailable');
  });
  it('sorts a frozen copy newest first with stable ties and invalid dates last', () => {
    const posts = Object.freeze([
      { id: 'invalid-a', createdAt: 'bad' }, { id: 'old', createdAt: '2025-01-01' },
      { id: 'new', createdAt: '2026-01-01' }, { id: 'tie', createdAt: '2026-01-01' },
      { id: 'invalid-b', createdAt: 'bad too' },
    ]);
    expect(newestFirst(posts).map((p) => p.id)).toEqual(['new', 'tie', 'old', 'invalid-a', 'invalid-b']);
    expect(posts[0].id).toBe('invalid-a');
    expect(newestFirst(posts)[0]).toBe(posts[2]);
    expect(newestFirst([])).toEqual([]);
  });
  it('bounds excerpts at 120 without trimming, ellipsis or HTML interpretation', () => {
    expect(excerpt('a'.repeat(121))).toBe('a'.repeat(120));
    expect(excerpt('a'.repeat(120))).toHaveLength(120);
    expect(excerpt(' <script>text</script> ')).toBe(' <script>text</script> ');
    expect(excerpt('')).toBe('');
    expect(excerpt(null)).toBe('');
  });
});
