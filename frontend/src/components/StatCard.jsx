/** Present a quiet metric, distinguishing unreadable counts from valid zero. */
import PropTypes from 'prop-types';

/** Label one derived count; null means unavailable, never zero. */
export function StatCard({ label, value }) {
  return (
    <div aria-label={label} className="rounded-control border border-border bg-surface p-6 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-foreground-muted dark:text-slate-300">{label}</p>
      <p className="mt-3 text-3xl font-medium tabular-nums text-foreground dark:text-slate-100">{value === null ? 'Unavailable' : value}</p>
    </div>
  );
}
StatCard.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.number };
