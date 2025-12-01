import { type ChangeEvent, type FormEvent, useState } from 'react';
import type { Credentials } from '../types';

interface LoginFormProps {
  onLogin: (credentials: Credentials) => Promise<void>;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [credentials, setCredentials] = useState<Credentials>({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCredentialChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      await onLogin(credentials);
      setCredentials({ username: '', password: '' });
    } catch (err) {
      if (err instanceof Error) {
        setLoginError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell login-page">
      <header className="app-header">
        <div>
          <h1>FileVue</h1>
          <p className="subtitle">Browse and audit an existing folder directly from your browser.</p>
        </div>
      </header>
      <div className="login-container">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          <p>Enter the explorer credentials to continue.</p>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            value={credentials.username}
            onChange={handleCredentialChange}
            required
            disabled={submitting}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={credentials.password}
            onChange={handleCredentialChange}
            required
            disabled={submitting}
          />
          {loginError && <div className="notice error">{loginError}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
