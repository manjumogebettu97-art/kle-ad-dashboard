import React, { useState, useEffect } from 'react';
import {
  getSettings, updateSettings,
  getUsers, deleteUser, register,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ linkedin_account: '', google_account: '' });
  const [users,    setUsers]    = useState([]);
  const [newUser,  setNewUser]  = useState({ name: '', email: '', password: '', role: 'user' });
  const [saving,   setSaving]   = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [error,    setError]    = useState('');

  useEffect(() => {
    Promise.all([getSettings(), getUsers()])
      .then(([s, u]) => {
        setSettings((prev) => ({ ...prev, ...s.data }));
        setUsers(u.data);
      })
      .catch(() => setError('Failed to load settings.'));
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(''); setError('');
    try {
      await updateSettings(settings);
      setMsg('Settings saved successfully.');
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAdding(true);
    setMsg(''); setError('');
    try {
      const res = await register(newUser);
      setUsers((u) => [...u, res.data]);
      setNewUser({ name: '', email: '', password: '', role: 'user' });
      setMsg(`User "${res.data.name}" created.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    try {
      await deleteUser(id);
      setUsers((u) => u.filter((x) => x.id !== id));
      setMsg(`User "${name}" deleted.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Settings</h1>
      <p style={styles.pageSubtitle}>Admin-only configuration</p>

      {msg   && <div style={styles.success}>{msg}</div>}
      {error && <div className="error-msg">{error}</div>}

      {/* ── Data Source Settings ── */}
      <section className="card">
        <h2 style={styles.sectionTitle}>Account Display Names</h2>
        <p style={{ color: '#64748b', fontSize: '.875rem', marginBottom: '1rem' }}>
          Labels shown on the dashboard. Data is ingested from CSV reports dropped into{' '}
          <code style={styles.code}>backend/data/imports/</code>.
        </p>
        <form onSubmit={handleSaveSettings} style={styles.form}>
          <label style={styles.label}>
            LinkedIn Account Name
            <input
              type="text"
              value={settings.linkedin_account || ''}
              onChange={(e) => setSettings((s) => ({ ...s, linkedin_account: e.target.value }))}
              style={styles.input}
              placeholder="e.g. Acme Corp LinkedIn"
            />
          </label>

          <label style={styles.label}>
            Google Ads Account Name
            <input
              type="text"
              value={settings.google_account || ''}
              onChange={(e) => setSettings((s) => ({ ...s, google_account: e.target.value }))}
              style={styles.input}
              placeholder="e.g. Acme Corp Google"
            />
          </label>

          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </section>

      {/* ── User Management ── */}
      <section className="card">
        <h2 style={styles.sectionTitle}>User Management</h2>

        <table style={styles.table}>
          <thead>
            <tr>
              {['Name', 'Email', 'Role', 'Created', 'Actions'].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={styles.td}><strong>{u.name}</strong></td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>
                  <span className={`badge ${u.role === 'admin' ? 'badge-linkedin' : 'badge-google'}`}>
                    {u.role}
                  </span>
                </td>
                <td style={styles.td}>{u.created_at?.split('T')[0]}</td>
                <td style={styles.td}>
                  {u.id !== user.id && (
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '.75rem', padding: '.25rem .6rem' }}
                      onClick={() => handleDelete(u.id, u.name)}
                    >
                      Delete
                    </button>
                  )}
                  {u.id === user.id && <span style={{ color: '#94a3b8', fontSize: '.8rem' }}>You</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add user form */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
          <h3 style={{ ...styles.sectionTitle, fontSize: '.95rem', marginBottom: '1rem' }}>
            Add New User
          </h3>
          <form onSubmit={handleAddUser} style={{ ...styles.form, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={styles.label}>
              Name
              <input
                required
                value={newUser.name}
                onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                style={styles.input}
                placeholder="Full name"
              />
            </label>
            <label style={styles.label}>
              Email
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                style={styles.input}
                placeholder="email@example.com"
              />
            </label>
            <label style={styles.label}>
              Password
              <input
                type="password"
                required
                minLength={6}
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                style={styles.input}
                placeholder="min 6 characters"
              />
            </label>
            <label style={styles.label}>
              Role
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                style={styles.input}
              >
                <option value="user">User (read-only)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={adding}>
                {adding ? 'Adding…' : '+ Add User'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Importing reports ── */}
      <section className="card">
        <h2 style={styles.sectionTitle}>Importing Reports</h2>
        <p style={{ color: '#64748b', fontSize: '.9rem', lineHeight: 1.7 }}>
          Data is loaded from CSV exports (UTF-16 TSV from Google Ads / LinkedIn Campaign Manager).
        </p>
        <ol style={{ marginTop: '.75rem', paddingLeft: '1.25rem', color: '#475569', fontSize: '.875rem', lineHeight: 2 }}>
          <li>Drop reports into <code style={styles.code}>backend/data/imports/&lt;platform&gt;-&lt;sub&gt;/</code> (e.g. <code style={styles.code}>google-display/</code>, <code style={styles.code}>linkedin-sponsored/</code>)</li>
          <li>Run <code style={styles.code}>npm run import</code> from the <code style={styles.code}>backend/</code> directory</li>
          <li>Each folder represents one date-range / sub-platform — re-running upserts (no duplicates)</li>
        </ol>
      </section>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '1.5rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  pageTitle:    { fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' },
  pageSubtitle: { fontSize: '.85rem', color: '#64748b', marginTop: '.25rem' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', marginBottom: '1rem' },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
    padding: '.5rem .75rem',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: '.9rem',
    background: '#f8fafc',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '.5rem .75rem',
    background: '#f8fafc',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '.75rem',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  td: {
    padding: '.75rem .75rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
  },
  success: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    color: '#166534',
    padding: '.75rem 1rem',
    borderRadius: 8,
    fontSize: '.875rem',
  },
  code: {
    background: '#f1f5f9',
    padding: '.1rem .4rem',
    borderRadius: 4,
    fontSize: '.85em',
    fontFamily: 'monospace',
  },
};
