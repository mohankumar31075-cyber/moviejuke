import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setProfileId } from '../api.js';
import { useApp } from '../store.jsx';

function PinPad({ onSubmit, onCancel, name }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="card center" style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ fontSize: '2.6rem' }}>🔐</div>
      <h2>{name}'s PIN</h2>
      <p className="muted">Enter the 4-digit PIN for this child profile.</p>
      <div className="pin-boxes">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={pin[i] || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const next = (pin + v).slice(0, 4);
              setPin(next);
              if (next.length === 4) onSubmit(next);
            }}
          />
        ))}
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="flex" style={{ justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { loginWithToken, user, refresh } = useApp();

  const [tab, setTab] = useState('otp');
  const [phone, setPhone] = useState('9000000001');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needProfile, setNeedProfile] = useState(null); // {token, children}

  const [classCode, setClassCode] = useState('');
  const [nickname, setNickname] = useState('');

  const [username, setUsername] = useState('teacher.meena');
  const [password, setPassword] = useState('teach123');

  const afterLogin = async (token) => {
    setProfileId(null);
    await loginWithToken(token);
    const me = await api.get('/auth/me');
    if (me.user.children?.length) {
      setNeedProfile({ token, children: me.user.children });
    } else {
      navigate('/');
    }
  };

  const requestOtp = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api.post('/auth/otp/request', { phone });
      setDemoOtp(r.demoOtp);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api.post('/auth/otp/verify', { phone, otp, name, consent });
      await afterLogin(r.token);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doClassCode = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api.post('/auth/class-code', { code: classCode, nickname });
      setProfileId(r.profile.id);
      await loginWithToken(r.token, r.profile.id);
      navigate('/live');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doPassword = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api.post('/auth/login', { username, password });
      await afterLogin(r.token);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (needProfile) {
    return (
      <div>
        <div className="center">
          <h1>Who is learning today?</h1>
          <p className="muted">Pick a child profile. Parents manage these from the parent dashboard.</p>
        </div>
        <div className="grid grid-3 mt-2">
          {needProfile.children.map((c) => (
            <button
              key={c.id}
              className="card card-hover center"
              style={{ border: 'none', cursor: 'pointer' }}
              onClick={async () => {
                // Profiles may have PINs; try without first, then show PIN pad on failure.
                try {
                  await api.post('/auth/profile', { profileId: c.id, pin: '' });
                  setProfileId(c.id);
                  await refresh();
                  navigate('/');
                } catch {
                  setNeedProfile({ ...needProfile, pinFor: c });
                }
              }}
            >
              <div style={{ fontSize: '3.2rem' }}>{c.avatar}</div>
              <h3 style={{ margin: '8px 0 2px' }}>{c.name}</h3>
              <div className="muted">{c.nickname}</div>
              <span className="pill" style={{ marginTop: 8 }}>{c.classId.toUpperCase()}</span>
            </button>
          ))}
        </div>
        {needProfile.pinFor && (
          <div className="mt-3">
            <PinPad
              name={needProfile.pinFor.name}
              onCancel={() => setNeedProfile({ ...needProfile, pinFor: null })}
              onSubmit={async (pin) => {
                try {
                  await api.post('/auth/profile', { profileId: needProfile.pinFor.id, pin });
                  setProfileId(needProfile.pinFor.id);
                  await refresh();
                  navigate('/');
                } catch (e) {
                  alert(e.message);
                }
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="center">
        <h1>Welcome to Knowledge Bank</h1>
        <p className="muted">Four ways to sign in — built for families and schools.</p>
      </div>

      <div className="tabs" style={{ justifyContent: 'center' }}>
        <button className={`tab ${tab === 'otp' ? 'active' : ''}`} onClick={() => setTab('otp')}>📱 Parent OTP</button>
        <button className={`tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>🎒 Class code</button>
        <button className={`tab ${tab === 'pwd' ? 'active' : ''}`} onClick={() => setTab('pwd')}>🔑 Username</button>
      </div>

      {tab === 'otp' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>1 · Parent's phone number</h3>
          <div className="field">
            <label>Mobile number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" />
          </div>
          {!demoOtp && (
            <button className="btn btn-primary btn-block" disabled={busy || phone.length < 10} onClick={requestOtp}>
              Send OTP
            </button>
          )}
          {demoOtp && (
            <>
              <div className="banner info">
                <span>💬</span>
                <div>Demo mode: your OTP is <b>{demoOtp}</b>. In production an Indian SMS provider (DLT-registered) delivers it.</div>
              </div>
              <div className="field">
                <label>Enter OTP</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" />
              </div>
              <div className="field">
                <label>Your name (new accounts)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" />
              </div>
              <label className="flex" style={{ alignItems: 'flex-start', marginBottom: 14, fontSize: '0.92rem' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4 }} />
                <span>
                  I am the parent/guardian and I give verifiable consent for my child's data under India's DPDP Act.
                  I understand progress is tied to my account and I can request deletion anytime.
                </span>
              </label>
              <button className="btn btn-primary btn-block" disabled={busy || otp.length < 6} onClick={verifyOtp}>
                Verify & continue
              </button>
            </>
          )}
          <p className="muted mt-2" style={{ fontSize: '0.85rem' }}>
            Then pick a child profile and protect it with a PIN or picture password.
          </p>
        </div>
      )}

      {tab === 'code' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>School student login</h3>
          <p className="muted">Use the class code your teacher shared. No phone number needed.</p>
          <div className="field">
            <label>Class code</label>
            <input value={classCode} onChange={(e) => setClassCode(e.target.value.toUpperCase())} placeholder="e.g. SUN7Q2" maxLength={8} />
          </div>
          <div className="field">
            <label>Pick a nickname (leaderboard name)</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. SpeedyTiger21" maxLength={20} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || !classCode} onClick={doClassCode}>
            Enter the classroom →
          </button>
          <div className="demo-account mt-2">
            <b>Demo class codes</b>
            SUN7Q2 — Class 4 – Sunshine (Maths)<br />
            STR4K8 — Class 3 – Stars (GK)
          </div>
        </div>
      )}

      {tab === 'pwd' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Username & password</h3>
          <p className="muted">Recommended for Class 3–5 students and staff. Parents usually prefer OTP.</p>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={doPassword}>Sign in</button>
          <div className="demo-accounts mt-2">
            <div className="demo-account"><b>Teacher</b> teacher.meena / teach123</div>
            <div className="demo-account"><b>Editor</b> editor.raj / edit123</div>
            <div className="demo-account"><b>Admin</b> admin / admin123</div>
          </div>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      <p className="center muted mt-2" style={{ fontSize: '0.9rem' }}>
        Browse content free without any account — <Link to="/browse">explore topics</Link>.
      </p>
    </div>
  );
}
