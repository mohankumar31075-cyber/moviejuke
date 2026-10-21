import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { TrialBanner } from '../components/Layout.jsx';

export default function ProfilePage() {
  const { user, profile, access, theme, setTheme, selectProfile, logout, curriculum } = useApp();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="card center">
        <h1>Profile</h1>
        <Link to="/login" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  const cls = curriculum?.classes?.find((c) => c.id === profile?.classId);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>My profile</h1>
      <TrialBanner />

      <div className="card">
        <div className="flex">
          <div style={{ fontSize: '3.2rem' }}>{profile?.avatar || '👤'}</div>
          <div>
            <h2 style={{ margin: 0 }}>{profile?.name || user.name}</h2>
            <div className="muted">
              {user.role} · {cls?.name || '—'}
              {profile?.nickname && ` · nickname ${profile.nickname}`}
            </div>
          </div>
        </div>

        {user.children?.length > 0 && (
          <>
            <h3 className="mt-3">Switch child profile</h3>
            <div className="flex">
              {user.children.map((c) => (
                <button
                  key={c.id}
                  className={`chip ${profile?.id === c.id ? 'active' : ''}`}
                  onClick={async () => {
                    try {
                      await selectProfile(c.id, '');
                    } catch {
                      const pin = prompt(`Enter PIN for ${c.name}`) || '';
                      try { await selectProfile(c.id, pin); } catch (e) { alert(e.message); }
                    }
                  }}
                >
                  {c.avatar} {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        <h3 className="mt-3">Screen style (age-adaptive)</h3>
        <div className="flex">
          <button className={`chip ${theme === 'young' ? 'active' : ''}`} onClick={() => setTheme('young')}>🧒 Young learner — big, colourful</button>
          <button className={`chip ${theme === 'elder' ? 'active' : ''}`} onClick={() => setTheme('elder')}>🧑 Explorer — compact, focused</button>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Pre-Nursery to Class 2 get the young layout by default; Class 3–5 get the explorer layout. You can switch anytime.
        </p>

        {access && (
          <div className="mt-3">
            <h3>Access</h3>
            <ul className="muted" style={{ lineHeight: 1.9 }}>
              <li>Plan: <b>{access.subscribed ? 'Subscription active' : access.school ? 'School licence' : 'Free tier'}</b></li>
              <li>Free subjects: {access.freeSubjects.join(', ').toUpperCase()}</li>
              <li>Trial quiz time left: <b>{Math.floor(access.trialSecondsLeft / 60)}:{String(access.trialSecondsLeft % 60).padStart(2, '0')}</b></li>
            </ul>
            {!access.subscribed && (
              <Link to="/pricing" className="btn btn-primary">Upgrade — ₹149/month</Link>
            )}
          </div>
        )}

        <div className="flex mt-3">
          <button className="btn btn-danger" onClick={() => { logout(); navigate('/'); }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
