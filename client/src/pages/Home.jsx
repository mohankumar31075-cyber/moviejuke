import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { Stat } from '../components/Layout.jsx';

export default function Home() {
  const { curriculum, user, access, theme } = useApp();
  const classes = curriculum?.classes || [];
  const subjects = curriculum?.subjects || [];
  const boards = curriculum?.boards || [];

  return (
    <div>
      <section className="hero">
        <h1>A whole curriculum in one joyful app 📚✨</h1>
        <p>
          Knowledge Bank is a complete learning companion for <b>Pre-Nursery to Class 5</b> —
          board-aligned notes, videos, audio lessons, quizzes, live multiplayer challenges and
          free certificates. Built for Indian boards and mobile networks.
        </p>
        <div className="hero-actions">
          <Link to="/browse" className="btn btn-gold">Start learning — free</Link>
          {user ? (
            <Link to={user.role === 'parent' ? '/parent' : user.role === 'teacher' ? '/teacher' : '/browse'} className="btn btn-ghost">
              Go to my dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-ghost">Sign in</Link>
          )}
        </div>
        <div className="hero-badges">
          <span className="hero-badge">🎮 Live quiz battles</span>
          <span className="hero-badge">🏅 Free certificates</span>
          <span className="hero-badge">👨‍👩‍👧 Parent dashboard</span>
          <span className="hero-badge">🏫 School licences</span>
          <span className="hero-badge">🗣️ Hindi & regional support</span>
        </div>
      </section>

      <section className="grid grid-4 mt-3">
        <Stat num="8" label="Class levels · Pre-Nursery to Class 5" />
        <Stat num="5" label="Subjects per class" />
        <Stat num="6" label="Quiz question types" />
        <Stat num="₹149" label="Per month · all subjects" />
      </section>

      <div className="section-title">
        <h2>Boards we follow</h2>
        <Link to="/browse" className="btn btn-ghost btn-sm">Browse content →</Link>
      </div>
      <div className="chip-row">
        {boards.map((b) => (
          <Link key={b.id} to={`/browse?board=${b.id}`} className="chip card-hover" style={{ textDecoration: 'none' }}>
            📌 {b.name} <span className="muted" style={{ fontWeight: 500 }}>· {b.blurb}</span>
          </Link>
        ))}
      </div>

      <div className="section-title">
        <h2>Pick your class</h2>
        {theme === 'young' ? <span className="pill gold">🧒 Young learner mode</span> : <span className="pill">🧑 Explorer mode</span>}
      </div>
      <div className="chip-row">
        {classes.map((c) => (
          <Link key={c.id} to={`/browse/${c.id}`} className="chip card-hover" style={{ textDecoration: 'none' }}>
            {c.ageBand === 'young' ? '🎈' : '🚀'} {c.name}
          </Link>
        ))}
      </div>

      <div className="section-title"><h2>Subjects</h2></div>
      <div className="grid grid-4">
        {subjects.map((s) => (
          <Link
            key={s.id}
            to={`/browse/c1/${s.id}`}
            className="subject-card card-hover"
            style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`, textDecoration: 'none' }}
          >
            {!s.free && <span className="lock" title="Subscription or trial">🔒</span>}
            <div className="icon">{s.icon}</div>
            <h3>{s.name}</h3>
            <p>{s.free ? 'Free for everyone' : 'Included with trial & subscription'}</p>
          </Link>
        ))}
      </div>

      <div className="section-title"><h2>What makes Knowledge Bank different</h2></div>
      <div className="grid grid-3">
        <div className="card card-hover">
          <div className="emoji-float">🎮</div>
          <h3>Live multiplayer quizzes</h3>
          <p className="muted">Kahoot-style sessions for up to 200+ players — join with a short code or QR, plus anytime leaderboards per quiz.</p>
        </div>
        <div className="card card-hover">
          <div className="emoji-float">🏅</div>
          <h3>Free auto-generated certificates</h3>
          <p className="muted">PDF certificates with QR verification and WhatsApp share — for every pass and every group-session topper (ties included).</p>
        </div>
        <div className="card card-hover">
          <div className="emoji-float">👨‍👩‍👧</div>
          <h3>Parents see real progress</h3>
          <p className="muted">Subject-wise scores, time spent learning and weak topics to practise — with child-safe, nickname-only leaderboards.</p>
        </div>
        <div className="card card-hover">
          <div className="emoji-float">🏫</div>
          <h3>Teacher & school tools</h3>
          <p className="muted">Class codes, quiz assignments, live sessions and class reports exported as PDF or Excel-friendly CSV.</p>
        </div>
        <div className="card card-hover">
          <div className="emoji-float">🇮🇳</div>
          <h3>Built for Indian boards</h3>
          <p className="muted">CBSE, ICSE, State boards and a generic track — with Hindi/regional-language content and low-data design.</p>
        </div>
        <div className="card card-hover">
          <div className="emoji-float">🛡️</div>
          <h3>Child-safe by design</h3>
          <p className="muted">Filtered nicknames, no chat, no free-text messaging. DPDP-compliant parental consent for children's data.</p>
        </div>
      </div>

      {!user && (
        <>
          <div className="section-title"><h2>Try the demo</h2></div>
          <div className="demo-accounts">
            <div className="demo-account">
              <b>👨‍👩‍👧 Parent</b>
              Phone <b>9000000001</b> → OTP <b>123456</b><br />
              Children: Aarav (Class 2), Diya (Class 4)
            </div>
            <div className="demo-account">
              <b>👩‍🏫 Teacher</b>
              username <b>teacher.meena</b> / <b>teach123</b><br />
              Classes, codes, reports, live sessions
            </div>
            <div className="demo-account">
              <b>📝 Content editor</b>
              username <b>editor.raj</b> / <b>edit123</b><br />
              Draft → review → publish workflow
            </div>
            <div className="demo-account">
              <b>🛡️ Admin / approver</b>
              username <b>admin</b> / <b>admin123</b><br />
              Users, pass marks, licences, approval
            </div>
            <div className="demo-account">
              <b>🎒 School student</b>
              Class code <b>SUN7Q2</b> + nickname<br />
              Or use any teacher class code
            </div>
          </div>
        </>
      )}

      {access && !access.subscribed && (
        <div className="banner info mt-3">
          <span>🎁</span>
          <div>
            Free tier: browse everything, English & GK quizzes forever, plus a one-time quiz trial for all subjects.
            {' '}<Link to="/pricing" style={{ fontWeight: 800, color: 'inherit' }}>See plans →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
