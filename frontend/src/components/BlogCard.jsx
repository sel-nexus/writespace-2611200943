/** Present an escaped post preview with display-only management eligibility. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { canManagePost } from '../utils/posts.js';
import { excerpt, formatDate } from '../utils/presentation.js';

const accents = ['border-t-primary-300 dark:border-t-indigo-300', 'border-t-secondary-300 dark:border-t-slate-400', 'border-t-primary-500 dark:border-t-indigo-400'];
const control = 'inline-flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-700 dark:focus-visible:ring-indigo-300';
/** Render a native reader link and an owner/admin edit link without invoking actions. */
export function BlogCard({ post, session = null, index = 0 }) {
  return (
    <article className={'min-w-0 rounded-control border border-border border-t-2 bg-surface p-6 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ' + accents[index % accents.length]}>
      <h2 className="break-words font-editorial text-2xl">
        <Link
          to={'/blog/' + encodeURIComponent(post.id)}
          className="rounded-control hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-indigo-300"
        >
          {post.title}
        </Link>
      </h2>
      <p className="mt-4 break-words leading-relaxed text-foreground-muted dark:text-slate-300">
        {excerpt(post.content)}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Avatar role="user" displayName={post.authorName} />
        <div className="min-w-0 break-words text-sm text-foreground-muted dark:text-slate-300">
          <p>{post.authorName}</p>
          <p>{formatDate(post.createdAt)}</p>
        </div>
      </div>
      {canManagePost(post, session) && (
        <Link to={'/edit/' + encodeURIComponent(post.id)} className={control + ' mt-4'}>
          Edit
        </Link>
      )}
    </article>
  );
}
BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired, title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired, createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired, authorName: PropTypes.string.isRequired,
  }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.oneOf(['user', 'admin']) }),
  index: PropTypes.number,
};
