/** Format local writing for display without changing persisted records. */
/**
 * Render an English calendar date or a safe unavailable label.
 * Args:
 *   value: Supply a persisted timestamp.
 * Returns:
 *   A date in MMM DD, YYYY form, using UTC for consistent previews.
 */
export function formatDate(value) {
  const date = typeof value === 'string' && value.trim() ? new Date(value) : new Date(NaN);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}
/**
 * Sort a copy newest first, keeping ties and invalid dates in input order.
 * Args:
 *   posts: Supply a validated collection of posts.
 * Returns:
 *   A new array with invalid timestamps placed last deterministically.
 */
export function newestFirst(posts) {
  return posts.map((post, index) => ({ post, index, time: Date.parse(post.createdAt) }))
    .sort((a, b) => {
      const aValid = Number.isFinite(a.time);
      const bValid = Number.isFinite(b.time);
      if (aValid !== bValid) return aValid ? -1 : 1;
      return (aValid ? b.time - a.time : 0) || a.index - b.index;
    }).map(({ post }) => post);
}
/**
 * Return only the first 120 content characters, without interpreting HTML.
 * Args:
 *   content: Supply plain-text writing.
 * Returns:
 *   A bounded excerpt, or empty text for a non-string value.
 */
export function excerpt(content) {
  return typeof content === 'string' ? content.slice(0, 120) : '';
}
