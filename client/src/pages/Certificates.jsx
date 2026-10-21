import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner } from '../components/Layout.jsx';

export default function Certificates() {
  const { user, profile } = useApp();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.get('/certificates').then((r) => setList(r.certificates)).catch((e) => setError(e.message));
  }, [user, profile]);

  if (!user) {
    return (
      <div className="card center">
        <div style={{ fontSize: '3rem' }}>🏅</div>
        <h1>Certificates live here</h1>
        <p className="muted">Sign in to see and download your free PDF certificates.</p>
        <Link to="/login" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }
  if (error) return <div className="alert error">{error}</div>;
  if (!list) return <Spinner />;

  return (
    <div>
      <div className="flex-between">
        <h1 style={{ margin: '6px 0' }}>My certificates 🏅</h1>
        <span className="pill green">Free · auto-generated PDF</span>
      </div>
      <p className="muted">
        Every passed quiz (at the subject pass mark) and every group-session top performer earns a certificate.
        Ties share the top spot — every tied player gets one.
      </p>

      {list.length === 0 && (
        <div className="card center">
          <div style={{ fontSize: '2.8rem' }}>🌱</div>
          <h3>No certificates yet</h3>
          <p className="muted">Pass any quiz at its pass mark (default 80%) to earn your first one.</p>
          <Link to="/browse" className="btn btn-primary">Find a quiz →</Link>
        </div>
      )}

      <div className="grid grid-3">
        {list.map((c) => (
          <div key={c.id} className="cert-card">
            <span className="pill gold">{c.kind === 'top' ? '🏆 Top performer' : '✅ Passed'}</span>
            <h3 style={{ margin: '10px 0 4px' }}>{c.title}</h3>
            <div className="muted">{c.profileName} · {c.pct}% · {new Date(c.date).toLocaleDateString('en-IN')}</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>{c.source}</div>
            <div className="cert-serial mt-2">{c.serial}</div>
            <div className="flex mt-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => downloadFile(`/certificates/${c.id}/pdf`, `${c.serial}.pdf`)}
              >
                ⬇️ PDF
              </button>
              <a
                className="btn whatsapp-btn btn-sm"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`I earned a Knowledge Bank certificate for "${c.title}"! 🏅 Verify it: ${window.location.origin}/verify/${c.serial}`)}`}
              >
                📤 WhatsApp
              </a>
            </div>
            <div className="muted mt-2" style={{ fontSize: '0.8rem' }}>
              <Link to={`/verify/${c.serial}`}>Verify online →</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="banner info mt-3">
        <span>🔐</span>
        <div>
          Each certificate carries a QR code and a unique serial (e.g. KB-2026-0001) so anyone can verify it on
          the <Link to="/verify/KB-2026-0001" style={{ color: 'inherit', fontWeight: 800 }}>verification page</Link>.
        </div>
      </div>
    </div>
  );
}

export function VerifyPage() {
  const { serial } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/verify/${serial}`).then(setData).catch((e) => setError(e.message));
  }, [serial]);

  if (error) {
    return (
      <div className="card center" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontSize: '3rem' }}>🔍</div>
        <h1>Certificate not found</h1>
        <p className="muted">Serial <b>{serial}</b> does not match any Knowledge Bank certificate.</p>
      </div>
    );
  }
  if (!data) return <Spinner />;

  return (
    <div className="card center" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: '3rem' }}>✅</div>
      <h1>Valid certificate</h1>
      <div className="cert-card" style={{ textAlign: 'left' }}>
        <span className="pill green">Verified</span>
        <h2 style={{ margin: '10px 0 4px' }}>{data.name}</h2>
        <p style={{ margin: '4px 0' }}>
          {data.kind === 'top' ? 'Top performer in' : 'Passed'} <b>{data.title}</b> ({data.pct}%)
        </p>
        <div className="muted">{data.source}</div>
        <div className="muted">Awarded {new Date(data.date).toLocaleDateString('en-IN')}</div>
        <div className="cert-serial">{data.serial}</div>
      </div>
      <p className="muted">This is an official Knowledge Bank certificate record.</p>
    </div>
  );
}
