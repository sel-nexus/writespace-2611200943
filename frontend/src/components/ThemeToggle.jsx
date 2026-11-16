/** Provide an accessible action to select the opposite appearance. */
import PropTypes from 'prop-types';

export function ThemeToggle({ theme, onToggle }) {
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onToggle}
      className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium
        hover:bg-surface-raised dark:hover:bg-slate-700 focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        dark:focus-visible:ring-indigo-300 dark:focus-visible:ring-offset-slate-900"
    >
      {label}
    </button>
  );
}

ThemeToggle.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  onToggle: PropTypes.func.isRequired,
};
