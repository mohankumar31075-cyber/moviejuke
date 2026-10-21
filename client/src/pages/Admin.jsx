import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner, Stat } from '../components/Layout.jsx';

export default function Admin() {
  const { user } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [passMark, setPassMark] = useState(80);

  const load = () => api.get('/admin/overview').then((r) => {
    setData(r);
    setPassMark(r.passMarks.default);
  }).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  if (!user || user.role !== 'admin') {
    return (
      <div className="card center">
        <div style={{ fontSize: '3rem' }}>🛡️</div>
        <h1>Super-admin area</h1>
        <p className="muted">Sign in as <b>admin / admin123</b> for users, payments, licences and content oversight.</p>
        <Link to="/login" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }
  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <Spinner />;

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 style={{ margin: '6px 0' }}>Platform admin 🛡️</h1>
          <p className="muted" style={{ margin: 0 }}>Users, subscriptions, school licences, content & settings.</p>
        </div>
        <Link to="/cms" className="btn btn-ghost btn-sm">Open CMS (approver view) →</Link>
      </div>

      <div className="grid grid-4 mt-2">
        <Stat num={data.counts.users} label="Users" />
        <Stat num={data.counts.subscribers} label="Paying parents" />
        <Stat num={data.counts.schools} label="Schools" />
        <Stat num={data.counts.certificates} label="Certificates issued" />
      </div>
      <div className="grid grid-4 mt-2">
        <Stat num={data.counts.profiles} label="Child profiles" />
        <Stat num={data.counts.content} label="Published content" />
        <Stat num={data.counts.inReview} label="Awaiting review" />
        <Stat num={data.counts.liveSessions} label="Live sessions run" />
      </div>

      <div className="banner info mt-3">
        <span>📈</span>
        <div>{data.revenueNote}</div>
      </div>

      <div className="card mt-3">
        <h2 style={{ marginTop: 0 }}>Users</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Phone</th><th>Subscription</th><th>Trial left</th></tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td><span className="pill gray">{u.role}</span></td>
                  <td>{u.phone || '—'}</td>
                  <td>
                    <span className={`pill ${u.subscription === 'active' ? 'green' : u.subscription === 'none' ? 'gray' : 'gold'}`}>
                      {u.subscription}
                    </span>
                  </td>
                  <td>{Math.round(u.trialSecondsLeft / 60)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2 mt-3">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>🏫 School licences</h2>
          {data.schools.map((s) => (
            <div key={s.id} className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <b>{s.name}</b>
                <div className="muted">{s.city} · {s.students} students · {s.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>₹{s.licenceFee.toLocaleString('en-IN')}/yr</b>
                <div className="muted" style={{ fontSize: '0.82rem' }}>{s.pilotDaysLeft} pilot days left</div>
              </div>
            </div>
          ))}
          <p className="muted mt-2" style={{ fontSize: '0.85rem' }}>
            Rate: ₹199/student/year · minimum ₹20,000/school/year · teachers free · 30-day pilot for new schools.
            School-licensed students get access in school sessions and at home.
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>🎯 Quiz pass marks</h2>
          <p className="muted">Default pass mark for certificates (suggested default 80%). Per-subject overrides apply too (GK is set to 70%).</p>
          <div className="field">
            <label>Default pass mark (%)</label>
            <input
              type="number" min={1} max={100} value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await api.put('/admin/pass-marks', { default: passMark });
              load();
            }}
          >
            Save pass mark
          </button>

          <h3 className="mt-3">Danger zone</h3>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('Reset all demo data back to seed state?')) {
                api.post('/admin/reset-demo').then(() => window.location.reload());
              }
            }}
          >
            🔄 Reset demo data
          </button>
        </div>
      </div>
    </div>
  );
}
