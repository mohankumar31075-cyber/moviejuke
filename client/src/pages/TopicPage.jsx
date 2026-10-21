import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner } from '../components/Layout.jsx';
import { speak } from '../components/QuizPlayer.jsx';

function NoteView({ content }) {
  return (
    <div>
      <div className="flex-between">
        <h2 style={{ margin: '0 0 12px' }}>{content.title}</h2>
        <button className="btn btn-gold btn-sm" onClick={() => speak(content.body.replace(/[#_*]/g, ' '))}>
          🔊 Read aloud
        </button>
      </div>
      <div className="body-note prose">{content.body}</div>
    </div>
  );
}

function VideoView({ content }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="media-card">
      <div className="media-poster" style={{ cursor: 'pointer' }} onClick={() => setPlaying(true)}>
        {content.posterEmoji || '🎬'}
        <div className="play">▶</div>
        {playing && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(15,17,50,0.88)',
            display: 'grid', placeItems: 'center', color: '#fff', padding: 20, textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: '2.6rem' }}>📺</div>
              <b>{content.title}</b>
              <p style={{ opacity: 0.85, maxWidth: 380 }}>
                In production this streams from our hosted video service (low-data, India CDN).
                The player is wired to plug in any hosted video URL.
              </p>
              <button className="btn btn-gold btn-sm" onClick={(e) => { e.stopPropagation(); setPlaying(false); }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="media-info">
        <h4>{content.title}</h4>
        <span>🎬 Video · {content.minutes} min</span>
      </div>
    </div>
  );
}

function AudioView({ content }) {
  return (
    <div className="media-card">
      <div className="media-info" style={{ padding: 22, flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
        <div className="flex">
          <div className="topic-emoji" style={{ background: '#f3e8ff', width: 60, height: 60, fontSize: '2rem' }}>🎧</div>
          <div>
            <h4>{content.title}</h4>
            <span>Audio lesson · {content.minutes} min</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => speak(content.script || content.title)}>
          ▶ Play audio lesson
        </button>
        <details style={{ width: '100%' }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>Show transcript</summary>
          <div className="body-note prose mt-2">{content.script || content.title}</div>
        </details>
      </div>
    </div>
  );
}

export default function TopicPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, curriculum } = useApp();
  const [data, setData] = useState(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const openedAt = useRef(Date.now());

  useEffect(() => {
    api.get(`/topics/${id}`).then((r) => { setData(r); setActive(0); openedAt.current = Date.now(); })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    // Track learning time (PRD: time spent learning on the parent dashboard).
    return () => {
      const secs = Math.round((Date.now() - openedAt.current) / 1000);
      if (user && secs > 3) api.post('/progress', { topicId: id, seconds: secs }).catch(() => {});
    };
  }, [id, user]);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <Spinner />;

  const { topic, contents, quiz } = data;
  const cls = curriculum?.classes?.find((c) => c.id === topic.classId);
  const subject = curriculum?.subjects?.find((s) => s.id === topic.subjectId);
  const content = contents[active];

  return (
    <div>
      <div className="muted" style={{ fontSize: '0.9rem' }}>
        <Link to={`/browse/${topic.classId}/${topic.subjectId}`} style={{ color: 'inherit' }}>
          {cls?.name} · {subject?.name}
        </Link>
        {' / '}{topic.title}
      </div>
      <h1 style={{ margin: '8px 0 4px' }}>{subject?.icon} {topic.title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{topic.summary}</p>

      <div className="tabs">
        {contents.map((c, i) => (
          <button key={c.id} className={`tab ${active === i ? 'active' : ''}`} onClick={() => setActive(i)}>
            {{ note: '📝', video: '🎬', audio: '🎧' }[c.type]} {c.title}
          </button>
        ))}
      </div>

      {content?.type === 'note' && <NoteView content={content} />}
      {content?.type === 'video' && <VideoView content={content} />}
      {content?.type === 'audio' && <AudioView content={content} />}

      {quiz && (
        <div className="card mt-3" style={{ background: 'linear-gradient(120deg, #5b4bff, #7c5cff)', color: '#fff', border: 'none' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ margin: '0 0 6px' }}>🎯 {quiz.title}</h2>
              <p style={{ margin: 0, opacity: 0.92 }}>
                {quiz.questionCount} questions · all types: multiple choice, true/false, fill-in, match, picture & audio.
                Pass at {quiz.passMark}% to earn a free certificate.
              </p>
            </div>
            <button
              className="btn btn-gold"
              onClick={() => navigate(`/quiz/${quiz.id}`)}
            >
              Start quiz →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
