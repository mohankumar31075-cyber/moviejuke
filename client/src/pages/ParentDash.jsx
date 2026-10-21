import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner, Stat, TrialBanner } from '../components/Layout.jsx';

const fmtTime = (s) => {
  if (!s) return '0 min';
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
};

export default function ParentDash() {
  const { user, curriculum, refresh } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [newChild, setNewChild] = useState({ name: '', classId: 'c1', pin: '1234', avatar: '🐯' });
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolMsg, setSchoolMsg] = useState('');

  const load = () => api.get('/parent/overview').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <Spinner />;

  const addChild = async () => {
    if (!newChild.name) return;
    await api.post('/profiles', newChild);
    setNewChild({ name: '', classId: 'c1', pin: '1234', avatar: '🐯' });
    await refresh();
    load();
  };

  const linkSchool = async () => {
    setSchoolMsg('');
    try {
      const child = data.children[0]?.profile?.id;
      const r = await api.post('/profiles/link-school', { code: schoolCode, profileId: child });
      setSchoolMsg(`Linked to ${r.className} ✅`);
      load();
    } catch (e) {
      setSchoolMsg(e.message);
    }
  };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 style={{ margin: '6px 0' }}>Parent dashboard 👨‍👩‍👧</h1>
          <p className="muted" style={{ margin: 0 }}>Hello {user.name} — here is how your children are progressing.</p>
        </div>
        <span className="pill">{user.phone ? `📱 ${user.phone}` : ''}</span>
      </div>

      <TrialBanner />

      <div className="grid grid-3 mt-2">
        <Stat num={data.children.length} label="Child profiles" />
        <Stat num={data.children.reduce((s, c) => s + c.attempts, 0)} label="Quiz attempts" />
        <Stat num={data.children.reduce((s, c) => s + c.certificates.length, 0)} label="Certificates earned" />
      </div>

      {data.children.map((child) => {
        const cls = curriculum?.classes?.find((c) => c.id === child.profile.classId);
        return (
          <div key={child.profile.id} className="card mt-3">
            <div className="flex-between">
              <div className="flex">
                <div style={{ fontSize: '2.8rem' }}>{child.profile.avatar}</div>
                <div>
                  <h2 style={{ margin: 0 }}>{child.profile.name} <span className="pill">{cls?.name || child.profile.classId}</span></h2>
                  <div className="muted">Nickname: <b>{child.profile.nickname}</b> · {fmtTime(child.totalSeconds)} learning time · {child.attempts} quiz attempts</div>
                </div>
              </div>
              <Link to={`/browse/${child.profile.classId}`} className="btn btn-ghost btn-sm">Browse {child.profile.name}'s class →</Link>
            </div>

            <h3 className="mt-2">Progress by subject</h3>
            <div className="grid grid-4">
              {child.subjects.map((s) => (
                <div key={s.subject.id} className="stat" style={{ textAlign: 'left' }}>
                  <div className="flex-between">
                    <span>{s.subject.icon} {s.subject.name}</span>
                    <b>{s.avgPct === null ? '—' : `${s.avgPct}%`}</b>
                  </div>
                  <div className="progress-track" style={{ margin: '10px 0 8px' }}>
                    <div style={{
                      width: `${s.avgPct || 0}%`,
                      background: s.avgPct >= 80 ? '#22c55e' : s.avgPct >= 50 ? '#f5a623' : '#ff6b6b',
                    }} />
                  </div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{s.attempts} attempts · {fmtTime(s.seconds)}</div>
                </div>
              ))}
            </div>

            {child.weakTopics.length > 0 && (
              <>
                <h3 className="mt-3">🎯 Weak topics to practise</h3>
                <div className="flex">
                  {child.weakTopics.map((w) => (
                    <Link key={w.topicId} to={`/topic/${w.topicId}`} className="chip">
                      💪 {w.title} <span className="muted">· best {w.bestPct}%</span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {child.certificates.length > 0 && (
              <>
                <h3 className="mt-3">🏅 Certificates</h3>
                <div className="grid grid-3">
                  {child.certificates.map((c) => (
                    <div key={c.id} className="cert-card">
                      <span className="pill gold">{c.kind === 'top' ? 'Top performer' : 'Passed'}</span>
                      <h3 style={{ margin: '8px 0 4px' }}>{c.title}</h3>
                      <div className="muted">{c.pct}% · {new Date(c.date).toLocaleDateString('en-IN')}</div>
                      <div className="cert-serial">{c.serial}</div>
                      <button
                        className="btn btn-primary btn-sm mt-2"
                        onClick={() => downloadFile(`/certificates/${c.id}/pdf`, `${c.serial}.pdf`)}
                      >
                        ⬇️ PDF
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className="grid grid-2 mt-3">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>➕ Add a child profile</h3>
          <div className="field">
            <label>Child's name</label>
            <input value={newChild.name} onChange={(e) => setNewChild({ ...newChild, name: e.target.value })} placeholder="Name" />
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label>Class</label>
              <select value={newChild.classId} onChange={(e) => setNewChild({ ...newChild, classId: e.target.value })}>
                {(curriculum?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Avatar</label>
              <select value={newChild.avatar} onChange={(e) => setNewChild({ ...newChild, avatar: e.target.value })}>
                {['🐯', '🦄', '🚀', '🦁', '🌻', '🪁', '⚡', '🌙', '🐼', '🐧'].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>4-digit PIN (child signs in with this)</label>
            <input value={newChild.pin} onChange={(e) => setNewChild({ ...newChild, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          </div>
          <button className="btn btn-primary" onClick={addChild}>Add profile</button>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>🔗 Link a school profile</h3>
          <p className="muted">
            Does your child's school use Knowledge Bank? Enter the class code to connect the school profile
            to this home account — school-licensed students get access at school and at home.
          </p>
          <div className="field">
            <label>Class code</label>
            <input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value.toUpperCase())} placeholder="e.g. SUN7Q2" maxLength={8} />
          </div>
          <button className="btn btn-ghost" onClick={linkSchool}>Link school profile</button>
          {schoolMsg && <div className={`alert ${schoolMsg.includes('✅') ? 'success' : 'error'}`}>{schoolMsg}</div>}
          <div className="banner info mt-2">
            <span>🔒</span>
            <div>Child safety: leaderboards show filtered nicknames only, there is no chat, and all data follows DPDP parental-consent rules.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
