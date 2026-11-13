/** Present a static, accessible role identity without images or persistence. */
import PropTypes from 'prop-types';

/** Render a crown for administrators and an open book for writers. */
export function Avatar({ role, displayName }) {
  return (
    <span role="img" aria-label={displayName + (role === 'admin' ? ' — Administrator' : ' — Writer')}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-surface-raised">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        {role === 'admin' ? (
          <path d="M4 18h16M5 15 3 6l5 4 4-6 4 6 5-4-2 9H5Z" />
        ) : (
          <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14" />
        )}
      </svg>
    </span>
  );
}
Avatar.propTypes = {
  role: PropTypes.oneOf(['admin', 'user']).isRequired,
  displayName: PropTypes.string.isRequired,
};
