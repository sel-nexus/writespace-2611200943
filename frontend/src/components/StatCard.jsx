/** Present a quiet metric, distinguishing unreadable counts from valid zero. */
import PropTypes from 'prop-types';

/** Label one derived count; null means unavailable, never zero. */
export function StatCard({ label, value }) {
  return (
    <div aria-label={label} className="rounded-control border border-border bg-surface p-6">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className="mt-3 text-3xl font-medium tabular-nums">{value === null ? 'Unavailable' : value}</p>
    </div>
  );
}
StatCard.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.number };
