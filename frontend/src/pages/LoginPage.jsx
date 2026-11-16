/** Present a controlled local-demo login form with retained failure state. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../utils/auth.js';

const fields = [
  ['username', 'Username', 'text', 'username'],
  ['password', 'Password', 'password', 'current-password'],
];
/** Validate on activation and navigate only after confirmed session persistence. */
export default function LoginPage() {
  const [form, setForm] = useState({
    username: '',
    password: '',
  });
  const [result, setResult] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Log in — WriteSpace browser-local demo'; }, []);
  /** Keep every field available when validation or browser persistence fails. */
  function submit(event) {
    event.preventDefault();
    const outcome = login(form.username, form.password);
    setResult(outcome);
    if (outcome.ok) navigate(outcome.redirectTo);
  }
  return (
    <section className="max-w-md py-section text-foreground dark:text-slate-100" aria-labelledby="auth-title">
      <h1 id="auth-title" className="font-editorial text-4xl">
        Log in
      </h1>
      <p className="mt-4 text-foreground-muted dark:text-slate-300">
        Use a local account, or try the demo administrator: admin / admin.
      </p>
      <form noValidate onSubmit={submit} className="mt-8 space-y-5">
        {fields.map(([key, label, type, autoComplete]) => (
          <div key={key}>
            <label htmlFor={key} className="block text-sm font-medium">
              {label}
            </label>
            <input id={key} name={key} type={type} autoComplete={autoComplete} required aria-required="true"
              value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              aria-invalid={Boolean(result?.errors?.[key])} aria-describedby={result?.errors?.[key] ? key + '-error' : undefined}
              className="mt-2 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-foreground dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100
                focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-indigo-300" />
            {result?.errors?.[key] && (
              <p id={key + '-error'} role="alert" className="mt-2 text-sm text-error-foreground dark:text-red-300">
                {result.errors[key]}
              </p>
            )}
          </div>
        ))}
        {result && !result.ok && !result.errors && (
          <p role="alert" className="text-sm text-error-foreground dark:text-red-300">
          {result.message}
        </p>
        )}
        <button type="submit" 
          className="min-h-11 rounded-control bg-primary-700 px-5 py-2 font-medium text-white hover:bg-primary-800 dark:bg-indigo-700 dark:text-white dark:hover:bg-indigo-600
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-300 dark:focus-visible:ring-offset-slate-950 disabled:opacity-50">
          Log in
        </button>
      </form>
      <p className="mt-6 text-sm text-foreground-muted dark:text-slate-300">
        New to this browser? 
        <Link to="/register" className="text-primary-700 underline focus-visible:ring-2 focus-visible:ring-ring dark:text-indigo-300 dark:hover:text-indigo-200 dark:focus-visible:ring-indigo-300">
          Register
        </Link>
      </p>
    </section>
  );
}
