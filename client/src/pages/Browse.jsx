import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner } from '../components/Layout.jsx';

const TYPE_ICON = { note: '📝', video: '🎬', audio: '🎧' };

export default function Browse() {
  const { classId: routeClass, subjectId: routeSubject } = useParams();
  const [params, setParams] = useSearchParams();
  const { curriculum, access, user, profile } = useApp();

  const [classId, setClassId] = useState(routeClass || profile?.classId || 'c1');
  const [subjectId, setSubjectId] = useState(routeSubject || 'eng');
  const [boardId, setBoardId] = useState(params.get('board') || 'cbse');
  const [topics, setTopics] = useState(null);

  useEffect(() => {
    if (routeClass) setClassId(routeClass);
    if (routeSubject) setSubjectId(routeSubject);
  }, [routeClass, routeSubject]);

  useEffect(() => {
    setTopics(null);
    api.get(`/topics?classId=${classId}&subjectId=${subjectId}&boardId=${boardId}`)
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]));
  }, [classId, subjectId, boardId]);

  if (!curriculum) return <Spinner />;
  const subject = curriculum.subjects.find((s) => s.id === subjectId);
  const cls = curriculum.classes.find((c) => c.id === classId);

  const locked = (sid) => {
    if (!user) return false;
    if (access?.subscribed || access?.school) return false;
    if (['eng', 'gk'].includes(sid)) return false;
    return (access?.trialSecondsLeft ?? 0) <= 0;
  };

  return (
    <div>
      <div className="flex-between">
        <h1 style={{ margin: '6px 0' }}>Explore learning content</h1>
        <span className="pill">No login needed to browse</span>
      </div>

      <div className="card mb-2">
        <div className="field">
          <label>Board</label>
          <div className="chip-row">
            {curriculum.boards.map((b) => (
              <button key={b.id} className={`chip ${boardId === b.id ? 'active' : ''}`} onClick={() => setBoardId(b.id)}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Class</label>
          <div className="chip-row">
            {curriculum.classes.map((c) => (
              <button key={c.id} className={`chip ${classId === c.id ? 'active' : ''}`} onClick={() => { setClassId(c.id); setParams({ board: boardId }); }}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Subject</label>
          <div className="chip-row">
            {curriculum.subjects.map((s) => (
              <button key={s.id} className={`chip ${subjectId === s.id ? 'active' : ''}`} onClick={() => setSubjectId(s.id)}>
                {s.icon} {s.name} {s.id === 'evs' && ['c3', 'c4', 'c5'].includes(classId) ? '(Science)' : ''}
                {locked(s.id) && ' 🔒'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {locked(subjectId) && (
        <div className="banner warn">
          <span>🔒</span>
          <div>
            <b>{subject?.name}</b> unlocks with the ₹149/month plan (or your one-time free trial).
            English & GK stay free. <Link to="/pricing" style={{ color: 'inherit', fontWeight: 800 }}>See plans →</Link>
          </div>
        </div>
      )}

      <div className="flex-between mb-2">
        <h2 style={{ margin: 0 }}>
          {subject?.icon} {cls?.name} · {subject?.name}
        </h2>
        <span className="muted">{topics ? `${topics.length} topics` : '…'}</span>
      </div>

      {!topics && <Spinner />}
      {topics && topics.length === 0 && (
        <div className="card center">
          <div style={{ fontSize: '2.6rem' }}>🌱</div>
          <h3>Topics for this combination are on the way!</h3>
          <p className="muted">Our content team (with AI assistance + human review) is adding more every week. Try another class or subject.</p>
        </div>
      )}
      <div className="stack">
        {topics && topics.map((t) => (
          <Link key={t.id} to={`/topic/${t.id}`} className="topic-row card-hover">
            <div className="topic-emoji">{subject?.icon || '📖'}</div>
            <div>
              <h3>{t.title}</h3>
              <p>{t.summary}</p>
              <div className="flex" style={{ marginTop: 8, gap: 8 }}>
                {t.contents.map((c) => (
                  <span key={c.id} className="pill gray">{TYPE_ICON[c.type]} {c.type}</span>
                ))}
              </div>
            </div>
            <div className="topic-meta">
              {t.quiz && <><b>{t.quiz.questionCount}</b> quiz Qs<br />pass mark {t.quiz.passMark}%</>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
