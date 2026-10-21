import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';

export function Layout({ children }) {
  const { user, profile, theme, setTheme, logout, curriculum } = useApp();
  const navigate = useNavigate();
  const cls = curriculum?.classes?.find((c) => c.id === profile?.classId);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="logo">
            <span className="logo-badge">📚</span>
            <span>
              Knowledge Bank
              <small>Learn • Practice • Achieve</small>
            </span>
          </Link>
          <nav className="nav-links">
            <NavLink to="/browse" end>Browse</NavLink>
            <NavLink to="/live">Live Quiz</NavLink>
            <NavLink to="/certificates">Certificates</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            {user?.role === 'parent' && <NavLink to="/parent">Parent</NavLink>}
            {user?.role === 'teacher' && <NavLink to="/teacher">Teacher</NavLink>}
            {user?.role === 'editor' && <NavLink to="/cms">CMS</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            <button
              className="chip"
              title="Switch age-adaptive theme"
              onClick={() => setTheme(theme === 'young' ? 'elder' : 'young')}
            >
              {theme === 'young' ? '🧒 Young' : '🧑 Explorer'}
            </button>
            {user ? (
              <>
                <Link to={user.role === 'parent' ? '/parent' : '/profile'} className="avatar-chip">
                  {profile?.avatar || '👤'} {profile?.nickname || user.name.split(' ')[0]}
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/'); }}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">Sign in</Link>
            )}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'none' }} className="mobile-only" />
        </div>
      </header>

      <main>
        <div className="container">{children}</div>
      </main>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="logo" style={{ color: '#fff' }}>
                <span className="logo-badge">📚</span> Knowledge Bank
              </div>
              <p style={{ maxWidth: 320, fontSize: '0.9rem', lineHeight: 1.6 }}>
                Board-aligned learning for Pre-Nursery to Class 5 — CBSE, ICSE, State boards and a generic track.
                Notes, videos, audio, quizzes, live challenges and free certificates.
              </p>
            </div>
            <div>
              <b>Product</b>
              <div className="stack" style={{ marginTop: 10, fontSize: '0.9rem' }}>
                <Link to="/browse">Browse content</Link>
                <Link to="/live">Live quiz</Link>
                <Link to="/pricing">Plans & school licences</Link>
                <Link to="/certificates">Certificates</Link>
              </div>
            </div>
            <div>
              <b>Trust & safety</b>
              <div className="stack" style={{ marginTop: 10, fontSize: '0.9rem' }}>
                <span>Nickname-only leaderboards, no chat</span>
                <span>Filtered nicknames, child-safe design</span>
                <span>DPDP: verifiable parental consent</span>
                <span>Original / licensed content only</span>
              </div>
            </div>
          </div>
          <div className="footer-note">
            Prices are exclusive of GST (added at checkout / on school invoices). Demo build — payments are simulated
            (PhonePe PG on web, Google Play Billing on Android). Curriculum content shown here is original demo material.
            {cls ? ` Current track: ${cls.name}.` : ''}
          </div>
        </div>
      </footer>

      <nav className="bottom-nav">
        <NavLink to="/" end><span className="ico">🏠</span>Home</NavLink>
        <NavLink to="/browse"><span className="ico">📖</span>Learn</NavLink>
        <NavLink to="/live"><span className="ico">🎮</span>Quiz</NavLink>
        <NavLink to="/certificates"><span className="ico">🏅</span>Certs</NavLink>
        <NavLink to={user ? (user.role === 'parent' ? '/parent' : user.role === 'teacher' ? '/teacher' : user.role === 'admin' ? '/admin' : '/profile') : '/login'}>
          <span className="ico">👤</span>Me
        </NavLink>
      </nav>
    </div>
  );
}

export function Spinner() {
  return <div className="spinning" aria-label="Loading" />;
}

export function Stat({ num, label }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function TrialBanner() {
  const { access, user } = useApp();
  if (!user || !access) return null;
  const { trialSecondsLeft, trialSecondsTotal, subscribed, school, warning } = access;
  if (subscribed || school) {
    return (
      <div className="banner ok">
        <span>✅</span>
        <div>{school ? 'School licence active — all subjects unlocked.' : 'Subscription active — all subjects, unlimited quizzes.'}</div>
      </div>
    );
  }
  const mins = Math.floor(trialSecondsLeft / 60);
  const secs = trialSecondsLeft % 60;
  if (trialSecondsLeft <= 0) {
    return (
      <div className="banner warn">
        <span>⏳</span>
        <div>
          Your free quiz trial has ended. English & GK stay free — unlock all subjects with the ₹149/month plan.{' '}
          <Link to="/pricing" style={{ color: 'inherit', fontWeight: 800 }}>See plans →</Link>
        </div>
      </div>
    );
  }
  return (
    <div className={`banner ${warning ? 'warn' : 'info'}`}>
      <span>{warning ? '⚠️' : '⏱️'}</span>
      <div>
        Free quiz trial: <b>{mins}:{String(secs).padStart(2, '0')}</b> left of {Math.round(trialSecondsTotal / 60)} min.
        {warning ? ' Almost done — subscribe to keep unlimited quizzes.' : ''}
      </div>
    </div>
  );
}
