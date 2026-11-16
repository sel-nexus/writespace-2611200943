/** Present the same account details in a desktop row or mobile card. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar.jsx';
import { formatDate } from '../utils/presentation.js';
import { deletionProtection } from '../utils/users.js';
import { DEFAULT_ADMIN } from '../utils/auth.js';

/** Render protected deletion with a tooltip and accessible explanation. */
export function UserRow({ user, session, onDelete, mobile = false }) {
  const reason = deletionProtection(user, session);
  const descriptionId = `${mobile ? 'card' : 'row'}-${user.id}-protection`;
  const identity = (
    <div className="flex items-center gap-3 break-words dark:[&_[role=img]]:border-slate-700 dark:[&_[role=img]]:bg-slate-800">
      <Avatar role={user.role} displayName={user.displayName} />
      <span>{user.displayName}</span>
    </div>
  );
  const date = user.id === DEFAULT_ADMIN.id ? 'Built-in account' : formatDate(user.createdAt);
  const action = (
    <span title={reason || undefined} className="inline-block">
      <button type="button" disabled={Boolean(reason)} title={reason || undefined}
        aria-label={'Delete ' + user.username} aria-describedby={reason ? descriptionId : undefined}
        className="min-h-11 rounded-control border border-border px-4 text-sm text-error-foreground hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-red-300 dark:hover:bg-slate-800 dark:focus-visible:ring-indigo-300"
        onClick={() => onDelete(user.id)}>
        Delete
      </button>
      {reason && <span id={descriptionId} className="sr-only">{reason}</span>}
    </span>
  );
  if (mobile) return (
    <article aria-label={'Account ' + user.username} className="space-y-4 rounded-control border border-border bg-surface p-5 text-foreground dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      {identity}
      <dl className="space-y-2 break-words text-sm">
        <dt className="text-foreground-muted dark:text-slate-300">Username</dt>
        <dd>{user.username}</dd>
        <dt className="text-foreground-muted dark:text-slate-300">Role</dt>
        <dd><span className="rounded-control bg-slate-100 px-2 py-1 text-slate-800 dark:bg-slate-700 dark:text-slate-100">{user.role}</span></dd>
        <dt className="text-foreground-muted dark:text-slate-300">Date joined</dt>
        <dd>{date}</dd>
      </dl>
      {action}
    </article>
  );
  return (
    <tr className="border-t border-border text-foreground dark:border-slate-700 dark:text-slate-100">
      <td className="p-4">{identity}</td>
      <td className="break-words p-4">{user.username}</td>
      <td className="p-4"><span className="rounded-control bg-slate-100 px-2 py-1 text-slate-800 dark:bg-slate-700 dark:text-slate-100">{user.role}</span></td>
      <td className="p-4 tabular-nums text-foreground-muted dark:text-slate-300">{date}</td>
      <td className="p-4">{action}</td>
    </tr>
  );
}
UserRow.propTypes = {
  user: PropTypes.shape({ id: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired, createdAt: PropTypes.string }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string }), onDelete: PropTypes.func.isRequired, mobile: PropTypes.bool,
};
