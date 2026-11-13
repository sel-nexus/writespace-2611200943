/** Create and remove eligible accounts without registration or session side effects. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRow } from '../components/UserRow.jsx';
import { readUsers, readSession, USERS_KEY, SESSION_KEY } from '../utils/storage.js';
import { allAccounts, createUser, deleteUser } from '../utils/users.js';

const emptyForm = { displayName: '', username: '', password: '', role: '' };
const control = 'min-h-11 rounded-control border border-border px-5 py-3 text-sm hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring';
const fields = [['displayName', 'Display name'], ['username', 'Username'], ['password', 'Password'], ['role', 'Role']];
/** Preserve drafts and saved records on all failures; refresh only after confirmed saves. */
export default function UserManagement() {
  const [users, setUsers] = useState(readUsers);
  const [session, setSession] = useState(() => readSession().value);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    document.title = 'Manage Users — WriteSpace browser-local demo';
    /** Refresh list and protected identity without replacing an unsaved draft. */
    function onStorage(event) {
      if (event.key === USERS_KEY || event.key === null) setUsers(readUsers());
      if (event.key === SESSION_KEY || event.key === null) setSession(readSession().value);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  /** Submit to the admin helper only, never register or start another session. */
  function submit(event) {
    event.preventDefault();
    setSuccess('');
    const result = createUser(form);
    setErrors(result.errors || {});
    setError(result.ok ? '' : result.message);
    if (!result.ok) return;
    setUsers(readUsers());
    setForm(emptyForm);
    setSuccess('Account created. Your session has not changed.');
  }
  /** Cancellation performs no mutation; failures keep the displayed row available. */
  function removeUser(id) {
    if (!window.confirm('Delete this account? Historical posts will be kept.')) return;
    setSuccess('');
    const result = deleteUser(id);
    setError(result.ok ? '' : result.message);
    if (!result.ok) return;
    setUsers(readUsers());
    setSuccess('Account deleted. Historical posts were kept.');
  }
  const accounts = users.ok ? allAccounts(users.value) : [];
  return (
    <section className="py-section">
      <h1 className="font-editorial text-headline">Manage Users</h1>
      <Link to="/admin" className={control + ' mt-6 inline-flex'}>Back to dashboard</Link>
      {!users.ok && (
        <div role="alert" className="mt-6 space-y-3 text-error-foreground">
          <p>Accounts unavailable: {users.status}. {users.message}</p>
          <p>Restore storage access or a saved copy. Clearing site data loses accounts and writing.</p>
          <button type="button" className={control} onClick={() => setUsers(readUsers())}>Retry loading accounts</button>
        </div>
      )}
      <section aria-labelledby="create-account" className="mt-10 max-w-reading">
        <h2 id="create-account" className="font-editorial text-3xl">Create account</h2>
        <form noValidate onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2">
          {fields.map(([field, label]) => (
            <div key={field}>
              <label htmlFor={'account-' + field} className="mb-2 block text-sm font-medium">{label}</label>
              {field === 'role' ? (
                <select id={'account-' + field} value={form[field]} required aria-required="true"
                  aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? field + '-error' : undefined}
                  className={control + ' w-full bg-surface'} onChange={(event) => setForm({ ...form, [field]: event.target.value })}>
                  <option value="">Choose a role</option>
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                </select>
              ) : (
                <input id={'account-' + field} type={field === 'password' ? 'password' : 'text'}
                  autoComplete={field === 'password' ? 'new-password' : 'off'} value={form[field]} required aria-required="true"
                  aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? field + '-error' : undefined}
                  className={control + ' w-full bg-surface'} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
              )}
              {errors[field] && <p id={field + '-error'} role="alert" className="mt-2 text-sm text-error-foreground">{errors[field]}</p>}
            </div>
          ))}
          <button type="submit" className={control + ' bg-primary-700 text-white hover:bg-primary-800 sm:col-span-2'}>Create User</button>
        </form>
      </section>
      {error && <p role="alert" className="mt-4 text-error-foreground">{error}</p>}
      {success && <p role="status" className="mt-4">{success}</p>}
      {users.ok && (
        <section aria-labelledby="local-accounts" className="mt-12">
          <h2 id="local-accounts" className="font-editorial text-3xl">Local accounts</h2>
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table aria-label="Local accounts" className="w-full text-left text-sm">
              <thead>
                <tr className="text-foreground-muted">
                  {['Display name', 'Username', 'Role', 'Date joined', 'Actions'].map((label) => <th key={label} scope="col" className="p-4 font-medium">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {accounts.map((user) => <UserRow key={user.id} user={user} session={session} onDelete={removeUser} />)}
              </tbody>
            </table>
          </div>
          <div aria-label="Account cards" className="mt-6 grid gap-4 md:hidden">
            {accounts.map((user) => <UserRow key={user.id} user={user} session={session} onDelete={removeUser} mobile />)}
          </div>
        </section>
      )}
      <p className="mt-8 text-sm text-foreground-muted">Other tabs refresh the list without discarding drafts. Concurrent changes are not transactional; the last write may overwrite another tab’s changes.</p>
    </section>
  );
}
