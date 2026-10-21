import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner } from './Layout.jsx';

const TYPE_LABEL = {
  mcq: 'Multiple choice',
  tf: 'True or False',
  fill: 'Fill in the blank',
  match: 'Match the following',
  picture: 'Picture question',
  audio: 'Listen & answer',
};

/** Speak question text with the Web Speech API (offline-friendly audio questions). */
export function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

function MatchWidget({ pairs, value, onChange }) {
  const [pickedLeft, setPickedLeft] = useState(null);
  const rights = useMemo(() => {
    const list = pairs.map(([, r]) => r);
    // deterministic shuffle so the order is stable across re-renders
    return [...list].sort((a, b) => (a.length - b.length) || a.localeCompare(b));
  }, [pairs]);
  const current = value || [];

  const pickLeft = (l) => setPickedLeft(l);
  const pickRight = (r) => {
    if (pickedLeft == null) return;
    const next = current.filter((x) => x.left !== pickedLeft && x.right !== r);
    next.push({ left: pickedLeft, right: r });
    onChange(next);
    setPickedLeft(null);
  };

  return (
    <div className="match-cols">
      <div className="stack">
        {pairs.map(([l]) => {
          const assigned = current.find((x) => x.left === l);
          return (
            <button
              key={l}
              type="button"
              className={`match-item ${pickedLeft === l ? 'picked' : ''} ${assigned ? 'matched-ok' : ''}`}
              onClick={() => pickLeft(l)}
            >
              {l} {assigned ? `→ ${assigned.right}` : ''}
            </button>
          );
        })}
      </div>
      <div className="stack">
        {rights.map((r) => (
          <button
            key={r}
            type="button"
            className={`match-item ${current.some((x) => x.right === r) ? 'matched-ok' : ''}`}
            onClick={() => pickRight(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionBody({ q, value, onChange, revealed, verdict }) {
  if (q.type === 'picture') {
    return (
      <>
        <div className="picture-emoji">{q.picture}</div>
        <div className="question-text">{q.text}</div>
        <div className="answer-grid">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`answer-btn ${value === i ? 'selected' : ''} ${revealed && verdict ? (i === q.correct ? 'correct' : value === i ? 'wrong' : '') : ''}`}
              onClick={() => !revealed && onChange(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      </>
    );
  }
  if (q.type === 'audio') {
    return (
      <>
        <div className="question-text">🎧 Listen and answer</div>
        <div className="center" style={{ margin: '16px 0' }}>
          <button type="button" className="btn btn-gold" onClick={() => speak(q.text)}>▶ Play sound</button>
          <div className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>
            (Uses your device voice — tap again to repeat.)
          </div>
        </div>
        <div className="question-text" style={{ fontSize: '1.15rem' }}>{q.text}</div>
        <div className="answer-grid">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`answer-btn ${value === i ? 'selected' : ''} ${revealed && verdict ? (i === q.correct ? 'correct' : value === i ? 'wrong' : '') : ''}`}
              onClick={() => !revealed && onChange(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      </>
    );
  }
  if (q.type === 'tf') {
    return (
      <>
        <div className="question-text">{q.text}</div>
        <div className="answer-grid">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              className={`answer-btn ${String(value) === String(v) ? 'selected' : ''} ${revealed && verdict ? (String(q.correct) === String(v) ? 'correct' : String(value) === String(v) ? 'wrong' : '') : ''}`}
              onClick={() => !revealed && onChange(v)}
            >
              {v ? '✅ True' : '❌ False'}
            </button>
          ))}
        </div>
      </>
    );
  }
  if (q.type === 'fill') {
    return (
      <>
        <div className="question-text">{q.text}</div>
        <input
          className="fill-input"
          placeholder="Type your answer…"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={revealed}
          autoFocus
        />
      </>
    );
  }
  if (q.type === 'match') {
    return (
      <>
        <div className="question-text">{q.text}</div>
        <p className="muted">Tap a left item, then the right item that goes with it.</p>
        <MatchWidget pairs={q.pairs} value={value} onChange={onChange} />
      </>
    );
  }
  return (
    <>
      <div className="question-text">{q.text}</div>
      <div className="answer-grid">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`answer-btn ${value === i ? 'selected' : ''} ${revealed && verdict ? (i === q.correct ? 'correct' : value === i ? 'wrong' : '') : ''}`}
            onClick={() => !revealed && onChange(i)}
          >
            {opt}
          </button>
        ))}
      </div>
    </>
  );
}

export function QuizPlayer({ quizId, onExit }) {
  const { user, profile, refresh } = useApp();
  const [quiz, setQuiz] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    api.get(`/quizzes/${quizId}`).then(setQuiz).catch((e) => setError(e.message));
    startedAt.current = Date.now();
  }, [quizId]);

  if (error) return <div className="alert error">{error}</div>;
  if (!quiz) return <Spinner />;

  const q = quiz.questions[idx];
  const total = quiz.questions.length;

  const setValue = (v) => setAnswers((a) => ({ ...a, [q.id]: v }));

  const hasAnswer = (question, val) => {
    if (val === undefined || val === null) return false;
    if (question.type === 'fill') return String(val).trim().length > 0;
    if (question.type === 'match') return Array.isArray(val) && val.length === question.pairs.length;
    return true;
  };

  const finish = async (finalAnswers) => {
    setBusy(true);
    try {
      const res = await api.post(`/quizzes/${quizId}/attempts`, {
        answers: finalAnswers,
        timeMs: Date.now() - startedAt.current,
      });
      setResult(res);
      refresh();
    } catch (e) {
      if (e.code === 'AUTH') {
        setError('Please sign in to save your score and earn certificates. Your answers are still here — sign in and finish again.');
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (idx < total - 1) {
      setIdx(idx + 1);
    } else {
      finish(answers);
    }
  };

  if (result) {
    const pct = result.attempt.pct;
    return (
      <div className="quiz-shell">
        <div className="card question-card center">
          <div style={{ fontSize: '3.4rem' }}>{pct >= result.passMark ? '🎉' : pct >= 50 ? '💪' : '🌱'}</div>
          <h2 style={{ margin: '6px 0' }}>
            {pct >= result.passMark ? 'Brilliant! You passed!' : 'Good effort — try again!'}
          </h2>
          <p className="muted">
            You scored <b>{result.attempt.correct}/{result.attempt.total}</b> ({pct}%)
            {' '}• pass mark {result.passMark}%
          </p>

          {result.certificate ? (
            <div className="cert-card" style={{ textAlign: 'left', marginTop: 18 }}>
              <span className="pill gold">Certificate unlocked</span>
              <h3>🏅 {result.certificate.title}</h3>
              <div className="cert-serial">{result.certificate.serial}</div>
              <div className="flex mt-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => window.open(`/api/certificates/${result.certificate.id}/pdf`, '_blank')}
                >
                  ⬇️ Download PDF
                </button>
                <a
                  className="btn whatsapp-btn btn-sm"
                  href={`https://wa.me/?text=${encodeURIComponent(`I earned a Knowledge Bank certificate for "${result.certificate.title}"! 🏅`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  📤 Share on WhatsApp
                </a>
                <Link to="/certificates" className="btn btn-ghost btn-sm">My certificates</Link>
              </div>
            </div>
          ) : (
            <div className="banner warn" style={{ marginTop: 18 }}>
              <span>📌</span>
              <div>Score {result.passMark}% or more to earn a free certificate.</div>
            </div>
          )}

          <div className="mt-3" style={{ textAlign: 'left' }}>
            <h3>Answer review</h3>
            {result.perQuestion.map((pq, i) => (
              <div key={pq.id} className={`verdict ${pq.correct ? 'good' : 'bad'}`}>
                <span>{pq.correct ? '✅' : '❌'}</span>
                <div>
                  <div>Question {i + 1} — {pq.correct ? 'Correct' : 'Not quite'}</div>
                  <div style={{ fontWeight: 500, fontSize: '0.92rem' }}>{pq.explain}</div>
                </div>
              </div>
            ))}
          </div>

          {result.trial && result.trial.usedSeconds > 0 && (
            <div className="banner info mt-2">
              <span>⏱️</span>
              <div>
                Trial time used: {Math.ceil(result.trial.usedSeconds)}s.
                {' '}<b>{Math.floor(result.trial.secondsLeft / 60)}:{String(result.trial.secondsLeft % 60).padStart(2, '0')}</b> left.
              </div>
            </div>
          )}

          <div className="flex mt-3" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setIdx(0); setAnswers({}); setResult(null); startedAt.current = Date.now(); }}>
              🔁 Try again
            </button>
            <button className="btn btn-ghost" onClick={onExit || (() => window.history.back())}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-shell">
      <div className="flex-between">
        <div>
          <span className="pill">{TYPE_LABEL[q.type]}</span>
          <h2 style={{ margin: '10px 0 0' }}>{quiz.title}</h2>
        </div>
        <div className="muted">Question <b>{idx + 1}</b> / {total}</div>
      </div>
      <div className="quiz-progress"><div style={{ width: `${((idx) / total) * 100}%` }} /></div>

      <div className="card question-card">
        {q.type === 'picture' || q.type === 'audio' ? (
          <QuestionBody q={q} value={answers[q.id]} onChange={setValue} />
        ) : (
          <>
            <div className="question-type">{TYPE_LABEL[q.type]}</div>
            <QuestionBody q={q} value={answers[q.id]} onChange={setValue} />
          </>
        )}
      </div>

      {error && (
        <div className="alert error">
          {error}{' '}
          {error.includes('sign in') && (
            <Link to="/login" style={{ color: '#9b2c2c', fontWeight: 800, textDecoration: 'underline' }}>Sign in now →</Link>
          )}
        </div>
      )}

      <div className="flex-between mt-2">
        <button
          className="btn btn-ghost"
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}
        >
          ← Back
        </button>
        {busy ? <Spinner /> : (
          <button
            className="btn btn-primary"
            disabled={!hasAnswer(q, answers[q.id])}
            onClick={next}
          >
            {idx < total - 1 ? 'Next question →' : 'Finish quiz 🎯'}
          </button>
        )}
      </div>

      {q.type === 'audio' && (
        <p className="muted center mt-2" style={{ fontSize: '0.85rem' }}>
          Audio questions use your device's voice — no data needed after the page loads.
        </p>
      )}
    </div>
  );
}

/** Standalone timer display for live sessions. */
export function Countdown({ seconds }) {
  return <div className="countdown-ring">{Math.max(0, seconds)}s</div>;
}
