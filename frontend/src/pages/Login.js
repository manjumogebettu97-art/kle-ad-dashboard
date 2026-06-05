import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / brand */}
        <div style={styles.brand}>
          <div style={styles.logoWrap}>
            <img
              src="/kle-university-logo.png"
              alt="KLE Academy of Higher Education & Research"
              style={styles.logo}
            />
          </div>
          <h1 style={styles.title}>KLE Academy of Higher Education &amp; Research</h1>
          <p style={styles.subtitle}>NIRF Campaign Dashboard — sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div className="error-msg">{error}</div>}

          <label style={styles.label}>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="admin@dashboard.com"
              style={styles.input}
              autoFocus
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              style={styles.input}
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '.75rem', fontSize: '1rem' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1A73E8 0%, #1557B0 100%)',
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '2.5rem',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,.25)',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logoWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '.75rem',
  },
  logo: {
    width: 72,
    height: 92,
    objectFit: 'contain',
    display: 'block',
  },
  title: {
    fontSize: '1.25rem',
    lineHeight: 1.25,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '.25rem',
  },
  subtitle: {
    fontSize: '.875rem',
    color: '#64748b',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.375rem',
    fontSize: '.875rem',
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '.625rem .875rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color .15s',
  },
};
