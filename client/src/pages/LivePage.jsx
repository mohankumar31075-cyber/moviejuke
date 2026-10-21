import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner, TrialBanner } from '../components/Layout.jsx';
import { speak } from '../components/QuizPlayer.jsx';

/* ==================== Live game view (/live/:code) ==================== */
export function LiveGame() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, profile, refresh } = useApp();
  const [session, setSession] = useState(null);
  const [you, setYou] = useState(null);
  const [error, setError] = useState('');
  const [answered, setAnswered] = useState(null); // value locked in for current question
  const [feedback, setFeedback] = useState(null);
  const answeredIdx = useRef(-1);

  const poll = useCallback(async () => {
    try {
      const r = await api.get(`/sessions/${code}`);
      setSession(r.session);
      if (r.you) setYou(r.you);
    } catch (e) {
      setError(e.message);
    }
  }, [code]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (session?.question && session.question.index !== answeredIdx.current) {
      answeredIdx.current = session.question.index;
      setAnswered(null);
      setFeedback(null);
      if (session.question.type === 'audio' && session.question.text) speak(session.question.text);
    }
  }, [session?.question]);

  if (error && !session) return <div className="alert error">{error} <Link to="/live">← Back</Link></div>;
  if (!session) return <Spinner />;

  const isHost = user && (user.role === 'teacher' || user.role === 'admin');

  const submitAnswer = async (value) => {
    if (answered !== null) return;
    setAnswered(value);
    const timeMs = session.question
      ? Math.max(0, session.questionSeconds * 1000 - session.question.secondsLeft * 1000)
      : 0;
    try {
      const r = await api.post(`/sessions/${code}/answer`, {
        answer: value, timeMs, nickname: profile?.nickname,
      });
      setFeedback({ correct: r.correct, pts: r.pts });
    } catch (e) {
      setFeedback({ correct: false, pts: 0, error: e.message });
    }
    poll();
  };

  if (session.status === 'lobby') {
    return (
      <div className="quiz-shell">
        <div className="card center">
          <span className="pill gold">Lobby open</span>
          <h1 style={{ margin: '12px 0' }}>{session.quizTitle}</h1>
          <div className="session-code">{session.code}</div>
          <p className="muted">
            Join at <b>/join/{session.code}</b> · or scan the QR code. Up to 200+ players supported.
          </p>
          <QrBox code={session.code} />
          <h3 className="mt-2">Players ({session.playerCount})</h3>
          <div className="leaderboard">
            {session.leaderboard.map((p) => (
              <div key={p.nickname} className="lb-row">
                <div className="lb-rank">{p.avatar}</div>
                <div className="lb-name">{p.nickname}</div>
                {p.isYou && <span className="pill">You</span>}
              </div>
            ))}
          </div>
          {isHost ? (
            <div className="mt-2">
              <button className="btn btn-primary btn-block" onClick={async () => {
                await api.post(`/sessions/${code}/start`, { bots: 6 });
                poll();
              }}>
                🚀 Start session (with simulated players)
              </button>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Scoring: <b>{session.scoring === 'plain' ? 'Plain points' : 'Points + speed bonus'}</b> ·
                {' '}{session.questionSeconds}s per question
              </p>
            </div>
          ) : (
            <p className="banner info"><span>✋</span><div>Waiting for the host to start…</div></p>
          )}
          {error && <div className="alert error">{error}</div>}
        </div>
      </div>
    );
  }

  if (session.status === 'finished') {
    const winners = session.winners?.length ? session.winners : (session.leaderboard[0] ? [session.leaderboard[0].nickname] : []);
    return (
      <div className="quiz-shell">
        <div className="card center">
          <div style={{ fontSize: '3.2rem' }}>🏁</div>
          <h1>Session finished!</h1>
          {winners.length > 0 && (
            <div className="banner ok">
              <span>🏆</span>
              <div>
                Top performer{winners.length > 1 ? 's (a tie — everyone takes the crown!)' : ''}:
                <b> {winners.join(', ')}</b> — certificates awarded.
              </div>
            </div>
          )}
          <h3>Final leaderboard</h3>
          <Leaderboard rows={session.leaderboard} />
          <div className="flex mt-3" style={{ justifyContent: 'center' }}>
            <Link to="/certificates" className="btn btn-primary">My certificates</Link>
            <Link to="/live" className="btn btn-ghost">Back to quizzes</Link>
          </div>
        </div>
      </div>
    );
  }

  // Live question phase
  const q = session.question;
  return (
    <div className="quiz-shell">
      <div className="flex-between">
        <div className="live-dot">LIVE · {session.code}</div>
        <div className="muted">Question {session.questionIndex + 1} / {session.questionCount}</div>
      </div>
      <div className="quiz-progress">
        <div style={{ width: `${((session.questionIndex) / session.questionCount) * 100}%` }} />
      </div>

      {q && (
        <div className="card question-card">
          <div className="flex-between">
            <span className="pill">{session.scoring === 'plain' ? 'Plain points' : 'Speed bonus active ⚡'}</span>
            <div className="countdown-ring">{q.secondsLeft}s</div>
          </div>

          {q.type === 'picture' && <div className="picture-emoji">{q.picture}</div>}
          {q.type === 'audio' ? (
            <>
              <div className="question-text">🎧 Listen and answer</div>
              <div className="center" style={{ margin: '12px 0' }}>
                <button className="btn btn-gold" onClick={() => speak(q.text)}>▶ Play sound</button>
              </div>
              <div className="question-text" style={{ fontSize: '1.15rem' }}>{q.text}</div>
            </>
          ) : (
            <div className="question-text">{q.text}</div>
          )}

          {q.type === 'match' ? (
            <div className="stack mt-2">
              {q.pairs.map(([l, r]) => (
                <button
                  key={l}
                  className={`answer-btn ${answered && answered.some((x) => x.left === l) ? 'selected' : ''}`}
                  disabled={answered !== null}
                  onClick={() => {
                    const next = (answered || []).filter((x) => x.left !== l);
                    next.push({ left: l, right: r });
                    if (next.length === q.pairs.length) submitAnswer(next);
                    else setAnswered(next);
                  }}
                >
                  {l} → {r}
                </button>
              ))}
              <p className="muted" style={{ fontSize: '0.85rem' }}>Tap each pair to lock it in ({(answered || []).length}/{q.pairs.length}).</p>
            </div>
          ) : q.type === 'fill' ? (
            <LiveFill onSubmit={submitAnswer} disabled={answered !== null} />
          ) : q.type === 'tf' ? (
            <div className="answer-grid">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  className={`answer-btn ${String(answered) === String(v) ? 'selected' : ''}`}
                  disabled={answered !== null}
                  onClick={() => submitAnswer(v)}
                >
                  {v ? '✅ True' : '❌ False'}
                </button>
              ))}
            </div>
          ) : (
            <div className="answer-grid">
              {(q.options || []).map((opt, i) => (
                <button
                  key={i}
                  className={`answer-btn ${answered === i ? 'selected' : ''}`}
                  disabled={answered !== null}
                  onClick={() => submitAnswer(i)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {feedback && (
            <div className={`verdict ${feedback.correct ? 'good' : 'bad'}`}>
              <span>{feedback.correct ? '⚡' : '💭'}</span>
              <div>
                {feedback.error || (feedback.correct
                  ? `Correct! +${feedback.pts} points${session.scoring !== 'plain' ? ' (includes speed bonus)' : ''}`
                  : 'Not this time — watch the leaderboard!')}
              </div>
            </div>
          )}
          {q.reveal && <div className="banner info mt-2"><span>⏱️</span><div>Time's up! Next question coming…</div></div>}
        </div>
      )}

      <div className="card mt-2">
        <h3 style={{ marginTop: 0 }}>Live leaderboard</h3>
        <Leaderboard rows={session.leaderboard} />
      </div>
    </div>
  );
}

function LiveFill({ onSubmit, disabled }) {
  const [val, setVal] = useState('');
  return (
    <form
      className="flex"
      onSubmit={(e) => { e.preventDefault(); if (val.trim()) onSubmit(val.trim()); }}
    >
      <input className="fill-input" style={{ marginTop: 0, flex: 1 }} placeholder="Type your answer…" value={val} disabled={disabled} onChange={(e) => setVal(e.target.value)} autoFocus />
      <button className="btn btn-primary" type="submit" disabled={disabled || !val.trim()}>Lock in</button>
    </form>
  );
}

export function Leaderboard({ rows }) {
  return (
    <div className="leaderboard">
      {rows.map((p, i) => (
        <div key={`${p.nickname}-${i}`} className={`lb-row ${p.isYou ? 'you' : ''} ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}>
          <div className="lb-rank">{i + 1}</div>
          <div className="lb-name">{p.avatar} {p.nickname} {p.isYou && <span className="pill">You</span>}</div>
          <div className="lb-score">{p.score ?? p.pct ?? 0}{p.pct !== undefined && p.score === undefined ? '%' : ''}</div>
        </div>
      ))}
      {rows.length === 0 && <div className="muted center">No entries yet — be the first!</div>}
    </div>
  );
}

function QrBox({ code }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    api.get(`/sessions/${code}/qr`).then((r) => setQr(r.qr)).catch(() => {});
  }, [code]);
  return qr ? <img src={qr} alt={`QR to join session ${code}`} width={180} height={180} /> : <Spinner />;
}

/* ==================== Join page (/join/:code) ==================== */
export function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useApp();
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/sessions/join', { code, nickname });
      navigate(`/live/${String(code).toUpperCase()}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="quiz-shell">
      <div className="card center">
        <div style={{ fontSize: '2.8rem' }}>🎮</div>
        <h1>Join live quiz</h1>
        <div className="session-code">{String(code || '').toUpperCase()}</div>
        <div className="field" style={{ textAlign: 'left', marginTop: 18 }}>
          <label>Your nickname (leaderboards show nicknames only)</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. SpeedyTiger21" maxLength={20} />
        </div>
        {error && <div className="alert error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy || !nickname.trim()} onClick={join}>
          {busy ? 'Joining…' : 'Join the fun →'}
        </button>
        {!user && <p className="muted" style={{ fontSize: '0.85rem' }}>No account needed to join. Nicknames are filtered for safety.</p>}
      </div>
    </div>
  );
}

/* ==================== Live hub (/live) ==================== */
export function LiveHub() {
  const { user, curriculum } = useApp();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [quizId, setQuizId] = useState('');
  const [scoring, setScoring] = useState('speed');
  const [seconds, setSeconds] = useState(49);
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const [leaderQuiz, setLeaderQuiz] = useState('');
  const [leaderboard, setLeaderboard] = useState(null);

  const isHost = user && (user.role === 'teacher' || user.role === 'admin');

  useEffect(() => {
    if (isHost) {
      api.get('/teacher/classes').then((r) => setQuizzes(r.quizzes)).catch(() => {});
    }
  }, [isHost]);

  const loadLeaderboard = async (qid) => {
    setLeaderQuiz(qid);
    if (!qid) { setLeaderboard(null); return; }
    const r = await api.get(`/quizzes/${qid}/leaderboard`);
    setLeaderboard(r.leaderboard);
  };

  return (
    <div>
      <TrialBanner />
      <div className="flex-between">
        <h1 style={{ margin: '6px 0' }}>Quiz arena 🎮</h1>
        <span className="pill gold">Up to 200+ players per session</span>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Join a live session</h2>
          <p className="muted">Enter the short code from your teacher — or open their link / QR.</p>
          <div className="field">
            <label>Session code</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. KB72"
              maxLength={8}
              style={{ textTransform: 'uppercase', letterSpacing: 4, fontWeight: 800, fontSize: '1.3rem' }}
            />
          </div>
          {error && <div className="alert error">{error}</div>}
          <button
            className="btn btn-primary btn-block"
            disabled={!joinCode.trim()}
            onClick={() => navigate(`/join/${joinCode.trim().toUpperCase()}`)}
          >
            Join →
          </button>
          <div className="banner info mt-2">
            <span>🛡️</span>
            <div>Nicknames only on leaderboards — no chat, filtered words, child-safe by design.</div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Anytime leaderboard</h2>
          <p className="muted">Every practice quiz has its own always-on leaderboard. Pick a quiz to see the stars.</p>
          <div className="field">
            <label>Quiz</label>
            <select value={leaderQuiz} onChange={(e) => loadLeaderboard(e.target.value)}>
              <option value="">Choose a quiz…</option>
              <AnytimeQuizOptions />
            </select>
          </div>
          {leaderboard && <Leaderboard rows={leaderboard.map((r) => ({ ...r, score: r.pct }))} />}
        </div>
      </div>

      {isHost && (
        <div className="card mt-3">
          <h2 style={{ marginTop: 0 }}>👩‍🏫 Host a live session</h2>
          <div className="grid grid-3">
            <div className="field">
              <label>Quiz</label>
              <select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
                <option value="">Pick a quiz…</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title} ({q.classId})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Scoring mode</label>
              <select value={scoring} onChange={(e) => setScoring(e.target.value)}>
                <option value="speed">Points + speed bonus (live default)</option>
                <option value="plain">Plain points</option>
              </select>
            </div>
            <div className="field">
              <label>Seconds per question</label>
              <input type="number" min={10} max={120} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={!quizId}
            onClick={async () => {
              try {
                const r = await api.post('/sessions', { quizId, scoring, questionSeconds: seconds, mode: 'live' });
                navigate(`/live/${r.session.code}`);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            🚀 Create session
          </button>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            You'll get a short code + QR. Defaults follow the PRD: 49 seconds per question, speed bonus for live,
            plain points for anytime mode. Speed time is measured from when the question reaches each device and the bonus is capped.
          </p>
        </div>
      )}
    </div>
  );
}

function AnytimeQuizOptions() {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    // Pull every topic's quiz via the topics endpoint per class/subject — a light loop.
    Promise.all(['c1', 'c2', 'c3', 'c4', 'c5'].flatMap((c) =>
      ['eng', 'math', 'evs', 'hin', 'gk'].map((s) =>
        api.get(`/topics?classId=${c}&subjectId=${s}`).catch(() => ({ topics: [] }))
      )
    )).then((all) => {
      const seen = new Map();
      for (const r of all) {
        for (const t of r.topics || []) {
          if (t.quiz) seen.set(t.quiz.id, { id: t.quiz.id, title: `${t.title}` });
        }
      }
      setOptions([...seen.values()]);
    });
  }, []);
  return options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>);
}
