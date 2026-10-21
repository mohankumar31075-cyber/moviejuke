// Knowledge Bank API server.
// Run: node server/index.js  (port 8787). The Vite dev server proxies /api here.
import express from 'express';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { getDb, saveDb, resetDb } from './store.js';
import { newId } from './seed.js';
import { filterNickname, randomNickname, isClean } from './utils/nicknames.js';
import {
  accessState, subjectUnlocked, requireUnlocked, consumeTrial, trialLeft, isSubscribed,
} from './utils/access.js';
import { scoreAnswer, passMarkFor } from './utils/scoring.js';
import { certificatePdf, classReportPdf } from './utils/pdf.js';

const app = express();
const PORT = process.env.PORT || 8787;
const BASE_URL = process.env.BASE_URL || '';

/** Public base URL for links/QR codes — derived from the request so it works behind proxies. */
function baseUrlFor(req) {
  if (BASE_URL) return BASE_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173';
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

app.use(express.json({ limit: '1mb' }));

// Allow the browser preview to hit us directly as well as via the Vite proxy.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Profile-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ============================= helpers ============================= */
const ok = (res, body) => res.json(body);
const bad = (res, code, message, status = 400) => res.status(status).json({ code, message });

function currentUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-auth-token'] || null);
  if (!token) return null;
  return getDb().users.find((u) => u.token === token) || null;
}

function currentProfile(req, user) {
  if (!user) return null;
  const pid = req.headers['x-profile-id'] || user.activeProfileId;
  return getDb().profiles.find((p) => p.id === pid) || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return bad(res, 'AUTH', 'Please sign in first.', 401);
  req.user = user;
  req.profile = currentProfile(req, user);
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role) && !req.user.permissions?.includes('super-admin')) {
        return bad(res, 'ROLE', 'This area needs a different role.', 403);
      }
      next();
    });
  };
}

const quizWithMeta = (db, quizId) => {
  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) return null;
  const topic = db.topics.find((t) => t.id === quiz.topicId);
  return { quiz, topic };
};

/** Strip answers before sending questions to a client. */
function sanitizeQuestions(db, quizId) {
  return db.questions.filter((q) => q.quizId === quizId).map((q) => {
    const { correct, answers, ...rest } = q;
    return rest;
  });
}

function gradeQuiz(db, quizId, answers = {}) {
  const qs = db.questions.filter((q) => q.quizId === quizId);
  let correct = 0;
  const perQuestion = [];
  for (const q of qs) {
    const given = answers[q.id];
    let isCorrect = false;
    if (q.type === 'fill') {
      const norm = (v) => String(v ?? '').trim().toLowerCase();
      isCorrect = q.answers.some((a) => norm(a) === norm(given));
    } else if (q.type === 'tf') {
      isCorrect = String(given) === String(q.correct);
    } else if (q.type === 'match') {
      // given: [{left, right}] pairs — order-independent, all must match
      const g = Array.isArray(given) ? given : [];
      isCorrect = q.pairs.length === g.length && q.pairs.every(([l, r]) =>
        g.some((x) => x && x.left === l && x.right === r));
    } else {
      isCorrect = Number(given) === Number(q.correct);
    }
    if (isCorrect) correct += 1;
    perQuestion.push({ id: q.id, correct: isCorrect, explain: q.explain });
  }
  const total = qs.length || 1;
  return { correct, total, pct: Math.round((correct / total) * 100), perQuestion };
}

function leaderboardForQuiz(db, quizId, limit = 20) {
  const byProfile = new Map();
  for (const a of db.attempts.filter((x) => x.quizId === quizId)) {
    const prev = byProfile.get(a.profileId);
    if (!prev || a.pct > prev.pct || (a.pct === prev.pct && a.timeMs < prev.timeMs)) byProfile.set(a.profileId, a);
  }
  const rows = [...byProfile.values()].sort((a, b) => b.pct - a.pct || a.timeMs - b.timeMs).slice(0, limit);
  return rows.map((a) => {
    const p = db.profiles.find((x) => x.id === a.profileId);
    return {
      nickname: p?.nickname || 'Learner', avatar: p?.avatar || '⭐',
      pct: a.pct, correct: a.correct, total: a.total, timeMs: a.timeMs, date: a.date,
      isYou: false,
    };
  });
}

/* ============================= auth ============================= */
const DEMO_OTP = '123456';

app.post('/api/auth/otp/request', (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  if (phone.length < 10) return bad(res, 'PHONE', 'Enter a valid 10-digit mobile number.');
  // In production: trigger DLT-registered SMS. Demo returns the OTP on screen.
  ok(res, { ok: true, demoOtp: DEMO_OTP, note: 'Demo mode: OTP is shown here instead of SMS.' });
});

app.post('/api/auth/otp/verify', (req, res) => {
  const db = getDb();
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  const otp = String(req.body?.otp || '');
  const name = String(req.body?.name || '').trim() || 'Parent';
  const consent = req.body?.consent === true;
  if (otp !== DEMO_OTP) return bad(res, 'OTP', 'Wrong OTP. In demo mode the OTP is 123456.');

  let user = db.users.find((u) => u.phone === phone);
  if (!user) {
    if (!consent) return bad(res, 'CONSENT', 'Please accept the parent consent (DPDP) to create an account.');
    user = {
      id: newId('u'), role: 'parent', name, phone, username: null, password: null,
      token: `tok_${crypto.randomBytes(12).toString('hex')}`,
      consentAt: new Date().toISOString(), consentVersion: 'DPDP-2026-01',
      trialSecondsTotal: db.trial.quizSecondsTotal, trialSecondsUsed: 0,
      subscription: { status: 'none', plan: null, since: null, renewsAt: null, method: null },
    };
    db.users.push(user);
    saveDb();
  }
  ok(res, { token: user.token, user: publicUser(db, user) });
});

app.post('/api/auth/login', (req, res) => {
  const db = getDb();
  const { username, password } = req.body || {};
  const user = db.users.find((u) => u.username === String(username || '').trim() && u.password === String(password || ''));
  if (!user) return bad(res, 'LOGIN', 'Wrong username or password.', 401);
  ok(res, { token: user.token, user: publicUser(db, user) });
});

app.post('/api/auth/class-code', (req, res) => {
  const db = getDb();
  const code = String(req.body?.code || '').trim().toUpperCase();
  const nickname = filterNickname(req.body?.nickname || randomNickname());
  const cls = db.teacherClasses.find((c) => c.code === code);
  if (!cls) return bad(res, 'CODE', 'No class found with that code.');
  if (!isClean(nickname)) return bad(res, 'NICK', 'Please pick a different nickname.');

  let profile = db.profiles.find((p) => p.schoolClassId === cls.id && p.nickname === nickname);
  if (!profile) {
    profile = {
      id: newId('p'), userId: null, name: nickname, nickname, classId: cls.classLevel,
      pin: null, avatar: '⭐', schoolClassId: cls.id, createdAt: new Date().toISOString(),
    };
    db.profiles.push(profile);
    cls.studentIds.push(profile.id);
    saveDb();
  }
  const user = {
    id: newId('u'), role: 'student', name: nickname, phone: null, username: null, password: null,
    token: `tok_${crypto.randomBytes(12).toString('hex')}`,
    consentAt: new Date().toISOString(), consentVersion: 'DPDP-2026-01',
    trialSecondsTotal: db.trial.quizSecondsTotal, trialSecondsUsed: 0,
    subscription: { status: 'active', plan: 'school', since: new Date().toISOString(), renewsAt: null, method: 'school' },
    activeProfileId: profile.id,
  };
  db.users.push(user);
  saveDb();
  ok(res, { token: user.token, user: publicUser(db, user), profile });
});

app.post('/api/auth/profile', requireAuth, (req, res) => {
  const db = getDb();
  const { profileId, pin } = req.body || {};
  const profile = db.profiles.find((p) => p.id === profileId && p.userId === req.user.id);
  if (!profile) return bad(res, 'PROFILE', 'Profile not found.');
  if (profile.pin && String(pin || '') !== profile.pin) return bad(res, 'PIN', 'Wrong PIN.');
  req.user.activeProfileId = profile.id;
  saveDb();
  ok(res, { profile });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = getDb();
  ok(res, {
    user: publicUser(db, req.user),
    profile: req.profile || null,
    access: accessState(req.user, req.profile),
  });
});

function publicUser(db, user) {
  return {
    id: user.id, role: user.role, name: user.name, phone: user.phone,
    username: user.username, activeProfileId: user.activeProfileId || null,
    subscription: user.subscription, trialSecondsLeft: trialLeft(user),
    trialSecondsTotal: user.trialSecondsTotal, permissions: user.permissions || [],
    children: db.profiles.filter((p) => p.userId === user.id).map((p) => ({
      id: p.id, name: p.name, nickname: p.nickname, classId: p.classId, avatar: p.avatar,
    })),
  };
}

/* ============================= profiles ============================= */
app.get('/api/profiles', requireAuth, (req, res) => {
  const db = getDb();
  ok(res, { profiles: db.profiles.filter((p) => p.userId === req.user.id) });
});

app.post('/api/profiles', requireAuth, (req, res) => {
  const db = getDb();
  const { name, classId, pin, avatar } = req.body || {};
  if (!name || !classId) return bad(res, 'FIELDS', 'Name and class are required.');
  const profile = {
    id: newId('p'), userId: req.user.id, name: String(name).slice(0, 24),
    nickname: filterNickname(name), classId,
    pin: String(pin || '1234').slice(0, 6), avatar: avatar || '⭐',
    schoolClassId: null, createdAt: new Date().toISOString(),
  };
  db.profiles.push(profile);
  saveDb();
  ok(res, { profile });
});

app.post('/api/profiles/link-school', requireAuth, (req, res) => {
  const db = getDb();
  const { code, profileId } = req.body || {};
  const cls = db.teacherClasses.find((c) => c.code === String(code || '').trim().toUpperCase());
  if (!cls) return bad(res, 'CODE', 'No class found with that code.');
  const profile = db.profiles.find((p) => p.id === profileId && p.userId === req.user.id);
  if (!profile) return bad(res, 'PROFILE', 'Pick one of your child profiles.');
  profile.schoolClassId = cls.id;
  if (!cls.studentIds.includes(profile.id)) cls.studentIds.push(profile.id);
  saveDb();
  ok(res, { profile, className: cls.name });
});

/* ============================= curriculum & content ============================= */
app.get('/api/curriculum', (req, res) => {
  const db = getDb();
  ok(res, {
    boards: db.boards, classes: db.classes, subjects: db.subjects,
    settings: db.settings, passMarks: db.passMarks,
  });
});

app.get('/api/topics', (req, res) => {
  const db = getDb();
  const { classId, subjectId, boardId } = req.query;
  let list = db.topics;
  if (classId) list = list.filter((t) => t.classId === classId);
  if (subjectId) list = list.filter((t) => t.subjectId === subjectId);
  const items = list.map((t) => {
    const contents = db.content.filter((c) => c.topicId === t.id && c.status === 'published');
    const quiz = db.quizzes.find((q) => q.topicId === t.id);
    return {
      ...t,
      boardIds: boardId && boardId !== 'generic' ? t.boardIds : t.boardIds,
      contents: contents.map((c) => ({ id: c.id, type: c.type, title: c.title, minutes: c.minutes })),
      quiz: quiz ? { id: quiz.id, title: quiz.title, passMark: quiz.passMark, questionCount: db.questions.filter((q) => q.quizId === quiz.id).length } : null,
    };
  });
  ok(res, { topics: items });
});

app.get('/api/topics/:id', (req, res) => {
  const db = getDb();
  const topic = db.topics.find((t) => t.id === req.params.id);
  if (!topic) return bad(res, 'TOPIC', 'Topic not found.', 404);
  const contents = db.content.filter((c) => c.topicId === topic.id && c.status === 'published');
  const quiz = db.quizzes.find((q) => q.topicId === topic.id);
  ok(res, {
    topic,
    contents,
    quiz: quiz ? { id: quiz.id, title: quiz.title, passMark: quiz.passMark, questionCount: db.questions.filter((q) => q.quizId === quiz.id).length } : null,
  });
});

app.get('/api/content/:id', (req, res) => {
  const db = getDb();
  const c = db.content.find((x) => x.id === req.params.id);
  if (!c) return bad(res, 'CONTENT', 'Content not found.', 404);
  ok(res, { content: c });
});

app.post('/api/progress', requireAuth, (req, res) => {
  const db = getDb();
  const { topicId, seconds } = req.body || {};
  const profile = req.profile || currentProfile(req, req.user);
  if (!profile || !topicId) return bad(res, 'FIELDS', 'Pick a child profile and topic.');
  let row = db.progress.find((p) => p.profileId === profile.id && p.topicId === topicId);
  if (!row) {
    row = { profileId: profile.id, topicId, seconds: 0, openedAt: new Date().toISOString() };
    db.progress.push(row);
  }
  row.seconds += Math.max(0, Math.min(600, Number(seconds) || 0));
  row.lastAt = new Date().toISOString();
  saveDb();
  ok(res, { seconds: row.seconds });
});

/* ============================= quizzes ============================= */
app.get('/api/quizzes/:id', (req, res) => {
  const db = getDb();
  const meta = quizWithMeta(db, req.params.id);
  if (!meta) return bad(res, 'QUIZ', 'Quiz not found.', 404);
  ok(res, {
    quiz: { id: meta.quiz.id, title: meta.quiz.title, passMark: meta.quiz.passMark, topicId: meta.quiz.topicId },
    topic: meta.topic,
    questions: sanitizeQuestions(db, meta.quiz.id),
  });
});

app.post('/api/quizzes/:id/attempts', requireAuth, (req, res) => {
  const db = getDb();
  const meta = quizWithMeta(db, req.params.id);
  if (!meta) return bad(res, 'QUIZ', 'Quiz not found.', 404);
  const profile = req.profile;
  if (!profile) return bad(res, 'PROFILE', 'Pick a child profile to save progress.');

  const gate = requireUnlocked(req.user, profile, meta.topic.subjectId);
  if (!gate.ok) return bad(res, gate.code, gate.message, 402);

  const { answers = {}, timeMs = 0 } = req.body || {};
  const graded = gradeQuiz(db, meta.quiz.id, answers);
  const passMark = passMarkFor(db.passMarks, meta.topic.subjectId, meta.quiz.passMark);
  const passed = graded.pct >= passMark;

  // Server-side trial accounting: quiz seconds count against the one-time trial.
  const trial = consumeTrial(req.user, Math.min(3600, (Number(timeMs) || 0) / 1000));

  const attempt = {
    id: newId('at'), profileId: profile.id, quizId: meta.quiz.id,
    correct: graded.correct, total: graded.total, pct: graded.pct,
    timeMs: Number(timeMs) || 0, date: new Date().toISOString(),
    mode: 'anytime', passed, passMark,
  };
  db.attempts.push(attempt);

  // Certificate on pass (free subjects always; other subjects while trial/sub active)
  let certificate = null;
  const certAllowed = ['eng', 'gk'].includes(meta.topic.subjectId)
    || isSubscribed(req.user)
    || req.user.subscription?.plan === 'school'
    || trial.used > 0 || trialLeft(req.user) > 0;
  if (passed && certAllowed) {
    db.counters.cert += 1;
    certificate = {
      id: newId('cert'), serial: `KB-2026-${String(db.counters.cert).padStart(4, '0')}`,
      profileId: profile.id, quizId: meta.quiz.id, kind: 'pass',
      title: meta.topic.title, pct: graded.pct,
      date: new Date().toISOString(), source: 'Practice Quiz',
    };
    db.certificates.push(certificate);
  }
  saveDb();

  ok(res, {
    attempt, passMark, passed,
    perQuestion: graded.perQuestion,
    certificate,
    trial: { secondsLeft: trial.left, usedSeconds: trial.used, total: req.user.trialSecondsTotal },
  });
});

app.get('/api/quizzes/:id/leaderboard', (req, res) => {
  const db = getDb();
  ok(res, { leaderboard: leaderboardForQuiz(db, req.params.id) });
});

app.get('/api/trial', requireAuth, (req, res) => {
  ok(res, accessState(req.user, req.profile));
});

/* ============================= live & anytime sessions ============================= */
const DEFAULT_Q_SECONDS = 49; // PRD §6

function sessionByCode(db, code) {
  return db.sessions.find((s) => s.code === String(code || '').trim().toUpperCase());
}

function sessionQuestions(db, session) {
  return db.questions.filter((q) => q.quizId === session.quizId);
}

function playerRow(db, p) {
  return {
    nickname: p.nickname, avatar: p.avatar || '⭐', score: p.score || 0,
    correct: p.correct || 0, answered: p.answered || 0, isBot: !!p.isBot,
    profileId: p.profileId || null,
  };
}

function botAnswer(session, q, player) {
  // Bots are decent, not perfect — keeps leaderboards lively.
  const skill = player.skill ?? 0.65;
  const correct = Math.random() < skill;
  const timeMs = Math.round(1500 + Math.random() * (session.questionSeconds * 1000 * 0.8));
  let answer;
  if (q.type === 'tf') answer = correct ? q.correct : !q.correct;
  else if (q.type === 'fill') answer = correct ? q.answers[0] : 'xxxx';
  else if (q.type === 'match') answer = correct ? q.pairs.map(([l, r]) => ({ left: l, right: r })) : [];
  else {
    const opts = q.options?.length || 2;
    answer = correct ? q.correct : (q.correct + 1 + Math.floor(Math.random() * (opts - 1))) % opts;
  }
  return { answer, timeMs, correct };
}

/** Lazy state machine — advances when polled, so no background timers needed. */
function tick(db, session) {
  if (session.status !== 'live') return;
  const qs = sessionQuestions(db, session);
  const now = Date.now();
  if (session.revealUntil && now >= session.revealUntil) {
    session.questionIndex += 1;
    session.questionStartedAt = now;
    session.revealUntil = null;
    session.botAnswersFor = null;
    if (session.questionIndex >= qs.length) {
      session.status = 'finished';
      finalizeSession(db, session);
    }
    saveDb();
    return;
  }
  if (!session.revealUntil && session.questionStartedAt
      && now >= session.questionStartedAt + session.questionSeconds * 1000) {
    // Time up — settle bots + settle unanswered players for this question.
    const q = qs[session.questionIndex];
    if (q) {
      if (session.botAnswersFor !== session.questionIndex) {
        for (const p of session.players.filter((x) => x.isBot)) {
          const a = botAnswer(session, q, p);
          const pts = scoreAnswer({
            correct: a.correct, timeMs: a.timeMs,
            questionMs: session.questionSeconds * 1000,
            scoring: session.scoring === 'plain' ? 'plain' : 'points_speed',
          });
          p.score += pts;
          p.correct += a.correct ? 1 : 0;
          p.answered += 1;
        }
        session.botAnswersFor = session.questionIndex;
      }
    }
    session.revealUntil = now + 4000;
    saveDb();
  }
}

function finalizeSession(db, session) {
  if (session.certified) return;
  const ranked = [...session.players].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? -1;
  const winners = ranked.filter((p) => p.score === top && top > 0);
  for (const w of winners) {
    if (w.isBot || !w.profileId) continue;
    db.counters.cert += 1;
    db.certificates.push({
      id: newId('cert'), serial: `KB-2026-${String(db.counters.cert).padStart(4, '0')}`,
      profileId: w.profileId, quizId: session.quizId, kind: 'top',
      title: `${db.quizzes.find((q) => q.id === session.quizId)?.title || 'Live Challenge'} — Live Session`,
      pct: 100, date: new Date().toISOString(),
      source: `Live Session ${session.code}`,
    });
  }
  session.certified = true;
  session.winners = winners.map((w) => w.nickname);
  saveDb();
}

app.post('/api/sessions', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const { quizId, scoring = 'speed', questionSeconds = DEFAULT_Q_SECONDS, mode = 'live' } = req.body || {};
  const meta = quizWithMeta(db, quizId);
  if (!meta) return bad(res, 'QUIZ', 'Pick a quiz to host.');
  const code = Math.random().toString(36).slice(2, 6).toUpperCase() + Math.floor(Math.random() * 90 + 10);
  const session = {
    id: newId('s'), code, hostId: req.user.id, classId: null,
    quizId, mode, scoring: mode === 'anytime' ? 'plain' : scoring,
    questionSeconds: Math.min(120, Math.max(10, Number(questionSeconds) || DEFAULT_Q_SECONDS)),
    status: 'lobby', questionIndex: -1, questionStartedAt: null,
    revealUntil: null, players: [], createdAt: new Date().toISOString(),
  };
  db.sessions.push(session);
  saveDb();
  ok(res, { session: publicSession(db, session) });
});

app.post('/api/sessions/join', (req, res) => {
  const db = getDb();
  const session = sessionByCode(db, req.body?.code);
  if (!session) return bad(res, 'CODE', 'Session not found. Check the code.', 404);
  if (session.status === 'finished') return bad(res, 'OVER', 'This session has already finished.');

  const user = currentUser(req);
  const profile = user ? currentProfile(req, user) : null;
  let nickname = filterNickname(req.body?.nickname || profile?.nickname || randomNickname());

  // One entry per profile per session.
  let player = session.players.find((p) => (profile && p.profileId === profile.id) || (!profile && p.nickname === nickname));
  if (!player) {
    // Keep nicknames unique inside the session.
    while (session.players.some((p) => p.nickname === nickname)) nickname = filterNickname(`${nickname}${Math.floor(Math.random() * 9)}`);
    player = {
      profileId: profile?.id || null, nickname, avatar: profile?.avatar || '⭐',
      score: 0, correct: 0, answered: 0, isBot: false,
    };
    session.players.push(player);
    saveDb();
  }
  ok(res, { session: publicSession(db, session), you: playerRow(db, player) });
});

function publicSession(db, session, forPlayer) {
  const meta = quizWithMeta(db, session.quizId);
  const qs = sessionQuestions(db, session);
  const now = Date.now();
  let question = null;
  if (session.status === 'live' && session.questionIndex >= 0 && session.questionIndex < qs.length) {
    const q = qs[session.questionIndex];
    const { correct, answers, ...rest } = q;
    question = {
      ...rest,
      index: session.questionIndex,
      total: qs.length,
      endsAt: session.questionStartedAt + session.questionSeconds * 1000,
      secondsLeft: Math.max(0, Math.ceil((session.questionStartedAt + session.questionSeconds * 1000 - now) / 1000)),
      reveal: !!session.revealUntil,
    };
  }
  return {
    code: session.code, status: session.status, mode: session.mode, scoring: session.scoring,
    questionSeconds: session.questionSeconds,
    quizTitle: meta?.quiz?.title || 'Quiz',
    quizId: session.quizId,
    topicId: meta?.quiz?.topicId || null,
    questionIndex: session.questionIndex,
    questionCount: qs.length,
    question,
    winners: session.winners || [],
    leaderboard: [...session.players]
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)
      .map((p, i) => ({ rank: i + 1, ...playerRow(db, p), isYou: forPlayer ? p.nickname === forPlayer.nickname : false })),
    playerCount: session.players.length,
  };
}

app.get('/api/sessions/:code', (req, res) => {
  const db = getDb();
  const session = sessionByCode(db, req.params.code);
  if (!session) return bad(res, 'CODE', 'Session not found.', 404);
  tick(db, session);
  const user = currentUser(req);
  const profile = user ? currentProfile(req, user) : null;
  const me = session.players.find((p) => (profile && p.profileId === profile.id));
  ok(res, { session: publicSession(db, session, me) });
});

app.post('/api/sessions/:code/start', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const session = sessionByCode(db, req.params.code);
  if (!session) return bad(res, 'CODE', 'Session not found.', 404);
  if (session.status !== 'lobby') return bad(res, 'STATE', 'Session already started.');

  // Fill the lobby with simulated players so the demo feels live (200+ supported in prod).
  const botCount = Math.min(24, Math.max(3, Number(req.body?.bots ?? 6)));
  for (let i = 0; i < botCount; i += 1) {
    session.players.push({
      profileId: null, nickname: randomNickname(), avatar: ['🤖', '🦊', '🐼', '🐧', '🦉', '🐢'][i % 6],
      score: 0, correct: 0, answered: 0, isBot: true, skill: 0.45 + Math.random() * 0.45,
    });
  }
  session.status = 'live';
  session.questionIndex = 0;
  session.questionStartedAt = Date.now();
  saveDb();
  ok(res, { session: publicSession(db, session) });
});

app.post('/api/sessions/:code/answer', (req, res) => {
  const db = getDb();
  const session = sessionByCode(db, req.params.code);
  if (!session) return bad(res, 'CODE', 'Session not found.', 404);
  tick(db, session);
  const { answer, timeMs = 0 } = req.body || {};
  const user = currentUser(req);
  const profile = user ? currentProfile(req, user) : null;
  const player = session.players.find((p) => (profile && p.profileId === profile.id)
    || p.nickname === req.body?.nickname);
  if (!player) return bad(res, 'PLAYER', 'Join the session first.', 404);
  if (session.status !== 'live') return bad(res, 'STATE', 'No question is live right now.');

  const qs = sessionQuestions(db, session);
  const q = qs[session.questionIndex];
  if (!q) return bad(res, 'STATE', 'No question is live right now.');
  if (player.answers?.[session.questionIndex] !== undefined) return ok(res, { already: true });

  let correct = false;
  if (q.type === 'fill') {
    const norm = (v) => String(v ?? '').trim().toLowerCase();
    correct = q.answers.some((a) => norm(a) === norm(answer));
  } else if (q.type === 'tf') {
    correct = String(answer) === String(q.correct);
  } else if (q.type === 'match') {
    const g = Array.isArray(answer) ? answer : [];
    correct = q.pairs.length === g.length && q.pairs.every(([l, r]) =>
      g.some((x) => x && x.left === l && x.right === r));
  } else {
    correct = Number(answer) === Number(q.correct);
  }

  const pts = scoreAnswer({
    correct, timeMs, questionMs: session.questionSeconds * 1000,
    scoring: session.scoring === 'plain' ? 'plain' : 'points_speed',
  });
  player.answers = player.answers || {};
  player.answers[session.questionIndex] = { answer, correct, pts };
  player.score += pts;
  player.correct += correct ? 1 : 0;
  player.answered += 1;
  saveDb();
  ok(res, { correct, pts, score: player.score });
});

app.post('/api/sessions/:code/next', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const session = sessionByCode(db, req.params.code);
  if (!session) return bad(res, 'CODE', 'Session not found.', 404);
  session.revealUntil = 0;
  session.questionIndex += 1;
  session.questionStartedAt = Date.now();
  session.botAnswersFor = null;
  const qs = sessionQuestions(db, session);
  if (session.questionIndex >= qs.length) {
    session.status = 'finished';
    finalizeSession(db, session);
  }
  saveDb();
  ok(res, { session: publicSession(db, session) });
});

app.get('/api/sessions/:code/qr', async (req, res) => {
  try {
    const url = `${baseUrlFor(req)}/join/${String(req.params.code || '').toUpperCase()}`;
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    ok(res, { url, qr: dataUrl });
  } catch (err) {
    console.error('qr failed:', err);
    bad(res, 'QR', 'Could not generate QR code.', 500);
  }
});

/* ============================= certificates ============================= */
app.get('/api/certificates', requireAuth, (req, res) => {
  const db = getDb();
  const profile = req.profile;
  const list = db.certificates
    .filter((c) => (profile ? c.profileId === profile.id : c.profileId && db.profiles.find((p) => p.id === c.profileId && p.userId === req.user.id)))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((c) => {
      const p = db.profiles.find((x) => x.id === c.profileId);
      return { ...c, profileName: p?.name || 'Learner' };
    });
  ok(res, { certificates: list });
});

app.get('/api/certificates/:id/pdf', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const c = db.certificates.find((x) => x.id === req.params.id);
    if (!c) return bad(res, 'CERT', 'Certificate not found.', 404);
    const profile = db.profiles.find((p) => p.id === c.profileId);
    const owns = profile && (profile.userId === req.user.id || req.profile?.id === profile.id || req.user.role === 'admin' || req.user.role === 'teacher');
    if (!owns) return bad(res, 'CERT', 'Not your certificate.', 403);
    const buf = await certificatePdf({ profile, certificate: c, baseUrl: baseUrlFor(req) });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="knowledge-bank-${c.serial}.pdf"`);
    res.send(buf);
  } catch (err) {
    console.error('certificate pdf failed:', err);
    bad(res, 'PDF', 'Could not generate the certificate PDF.', 500);
  }
});

app.get('/api/verify/:serial', (req, res) => {
  const db = getDb();
  const c = db.certificates.find((x) => x.serial === req.params.serial);
  if (!c) return bad(res, 'VERIFY', 'No certificate with this serial.', 404);
  const p = db.profiles.find((x) => x.id === c.profileId);
  ok(res, {
    valid: true, serial: c.serial, name: p?.name, title: c.title,
    pct: c.pct, date: c.date, kind: c.kind, source: c.source,
  });
});

/* ============================= parent dashboard ============================= */
app.get('/api/parent/overview', requireRole('parent', 'admin'), (req, res) => {
  const db = getDb();
  const children = db.profiles.filter((p) => p.userId === req.user.id).map((p) => {
    const attempts = db.attempts.filter((a) => a.profileId === p.id);
    const certs = db.certificates.filter((c) => c.profileId === p.id);
    const prog = db.progress.filter((x) => x.profileId === p.id);
    const subjectStats = db.subjects.map((s) => {
      const related = attempts.filter((a) => {
        const q = db.quizzes.find((z) => z.id === a.quizId);
        const t = q && db.topics.find((x) => x.id === q.topicId);
        return t?.subjectId === s.id;
      });
      const secs = prog.reduce((sum, pr) => {
        const t = db.topics.find((x) => x.id === pr.topicId);
        return t?.subjectId === s.id ? sum + pr.seconds : sum;
      }, 0);
      const avg = related.length ? Math.round(related.reduce((x, a) => x + a.pct, 0) / related.length) : null;
      return { subject: s, attempts: related.length, avgPct: avg, seconds: secs };
    });
    // Weak topics: topics with a failed attempt below pass mark.
    const weak = [];
    for (const a of attempts.filter((x) => !x.passed)) {
      const q = db.quizzes.find((z) => z.id === a.quizId);
      const t = q && db.topics.find((x) => x.id === q.topicId);
      if (t && !weak.find((w) => w.topicId === t.id)) {
        weak.push({ topicId: t.id, title: t.title, subjectId: t.subjectId, classId: t.classId, bestPct: a.pct });
      }
    }
    return {
      profile: { id: p.id, name: p.name, nickname: p.nickname, classId: p.classId, avatar: p.avatar },
      subjects: subjectStats,
      totalSeconds: prog.reduce((s, x) => s + x.seconds, 0),
      attempts: attempts.length,
      certificates: certs.map((c) => ({ id: c.id, serial: c.serial, title: c.title, kind: c.kind, pct: c.pct, date: c.date })),
      weakTopics: weak,
    };
  });
  ok(res, {
    children,
    subscription: req.user.subscription,
    access: accessState(req.user, req.profile),
  });
});

/* ============================= teacher dashboard ============================= */
app.get('/api/teacher/classes', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const classes = db.teacherClasses.filter((c) => c.teacherId === req.user.id || req.user.role === 'admin').map((c) => ({
    ...c,
    students: c.studentIds.map((id) => db.profiles.find((p) => p.id === id)).filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, nickname: p.nickname, avatar: p.avatar })),
    assignments: c.assignments.map((a) => {
      const done = db.attempts.filter((x) => x.quizId === a.quizId && c.studentIds.includes(x.profileId));
      return { ...a, submitted: new Set(done.map((d) => d.profileId)).size };
    }),
  }));
  ok(res, { classes, quizzes: db.quizzes.map((q) => {
    const t = db.topics.find((x) => x.id === q.topicId);
    return { id: q.id, title: q.title, topic: t?.title, subjectId: t?.subjectId, classId: t?.classId };
  }) });
});

app.post('/api/teacher/classes', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const { name, subjectId, classLevel } = req.body || {};
  if (!name) return bad(res, 'FIELDS', 'Class name is required.');
  const code = Math.random().toString(36).slice(2, 5).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const cls = {
    id: newId('tc'), teacherId: req.user.id, name: String(name).slice(0, 40),
    subjectId: subjectId || 'math', classLevel: classLevel || 'c4',
    code, createdAt: new Date().toISOString(), studentIds: [], assignments: [],
  };
  db.teacherClasses.push(cls);
  saveDb();
  ok(res, { class: cls });
});

app.post('/api/teacher/classes/:id/assign', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const cls = db.teacherClasses.find((c) => c.id === req.params.id);
  if (!cls) return bad(res, 'CLASS', 'Class not found.', 404);
  const meta = quizWithMeta(db, req.body?.quizId);
  if (!meta) return bad(res, 'QUIZ', 'Pick a quiz.');
  const asg = {
    id: newId('as'), quizId: meta.quiz.id, title: meta.quiz.title,
    due: req.body?.due || new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  cls.assignments.push(asg);
  saveDb();
  ok(res, { assignment: asg });
});

function classReportRows(db, cls) {
  return cls.studentIds.map((pid) => {
    const p = db.profiles.find((x) => x.id === pid);
    const attempts = db.attempts.filter((a) => a.profileId === pid && cls.assignments.some((as) => as.quizId === a.quizId));
    const certs = db.certificates.filter((c) => c.profileId === pid);
    const avgPct = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.pct, 0) / attempts.length) : 0;
    const bestPct = attempts.length ? Math.max(...attempts.map((a) => a.pct)) : 0;
    return {
      profileId: pid, name: p?.name || 'Student', nickname: p?.nickname || '—',
      attempts: attempts.length, avgPct, bestPct, certificates: certs.length,
    };
  });
}

app.get('/api/teacher/classes/:id/report', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const cls = db.teacherClasses.find((c) => c.id === req.params.id);
  if (!cls) return bad(res, 'CLASS', 'Class not found.', 404);
  const rows = classReportRows(db, cls);
  const attempts = rows.reduce((s, r) => s + r.attempts, 0);
  const avgPct = rows.length ? Math.round(rows.reduce((s, r) => s + r.avgPct, 0) / rows.length) : 0;
  const passRate = rows.length ? Math.round((rows.filter((r) => r.avgPct >= 80).length / rows.length) * 100) : 0;
  ok(res, {
    class: { id: cls.id, name: cls.name, code: cls.code },
    rows,
    summary: { students: rows.length, attempts, avgPct, passRate },
  });
});

app.get('/api/teacher/classes/:id/report.csv', requireRole('teacher', 'admin'), (req, res) => {
  const db = getDb();
  const cls = db.teacherClasses.find((c) => c.id === req.params.id);
  if (!cls) return bad(res, 'CLASS', 'Class not found.', 404);
  const rows = classReportRows(db, cls);
  const csv = [
    'Name,Nickname,Attempts,Avg %,Best %,Certificates',
    ...rows.map((r) => `"${r.name}","${r.nickname}",${r.attempts},${r.avgPct},${r.bestPct},${r.certificates}`),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${cls.name.replace(/\W+/g, '-')}-report.csv"`);
  res.send(csv);
});

app.get('/api/teacher/classes/:id/report.pdf', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const db = getDb();
    const cls = db.teacherClasses.find((c) => c.id === req.params.id);
    if (!cls) return bad(res, 'CLASS', 'Class not found.', 404);
    const rows = classReportRows(db, cls);
    const attempts = rows.reduce((s, r) => s + r.attempts, 0);
    const avgPct = rows.length ? Math.round(rows.reduce((s, r) => s + r.avgPct, 0) / rows.length) : 0;
    const passRate = rows.length ? Math.round((rows.filter((r) => r.avgPct >= 80).length / rows.length) * 100) : 0;
    const buf = await classReportPdf({
      teacherClass: cls, rows,
      summary: { students: rows.length, attempts, avgPct, passRate },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cls.name.replace(/\W+/g, '-')}-report.pdf"`);
    res.send(buf);
  } catch (err) {
    console.error('report pdf failed:', err);
    bad(res, 'PDF', 'Could not generate the report PDF.', 500);
  }
});

/* ============================= CMS ============================= */
app.get('/api/cms/items', requireRole('editor', 'admin'), (req, res) => {
  const db = getDb();
  let items = [...db.cmsItems];
  if (req.query.status) items = items.filter((i) => i.status === req.query.status);
  ok(res, {
    items: items.sort((a, b) => (a.status === 'in_review' ? -1 : 1)),
    canApprove: req.user.role === 'admin' || req.user.permissions?.includes('approve'),
  });
});

app.post('/api/cms/items', requireRole('editor', 'admin'), (req, res) => {
  const db = getDb();
  const { type = 'note', title, body, aiAssist } = req.body || {};
  if (!title) return bad(res, 'FIELDS', 'Title is required.');
  // topicId may be a real topic id or "classId|subjectId" from the CMS form.
  let topicId = req.body?.topicId;
  if (topicId && topicId.includes('|')) {
    const [c, s] = topicId.split('|');
    topicId = db.topics.find((t) => t.classId === c && t.subjectId === s)?.id || db.topics[0].id;
  }
  let finalBody = body || '';
  if (aiAssist) {
    // AI-assisted draft scaffold — always needs human review before publish (PRD §7).
    finalBody = [
      `# ${title}`,
      '',
      `Learning goal: learners will understand "${title}" with examples, practice and a short check-for-understanding.`,
      '',
      '1. Warm-up question to activate prior knowledge.',
      '2. Core explanation with 2–3 simple examples.',
      '3. A quick “Try it!” activity.',
      '4. Recap bullets.',
      '',
      '_(AI-assisted draft — an editor must verify facts and language before review.)_',
    ].join('\n');
  }
  const item = {
    id: newId('cms'), type, topicId: topicId || db.topics[0].id,
    title: String(title).slice(0, 120), body: finalBody,
    status: 'draft', author: req.user.username || req.user.name,
    submittedAt: null, reviewer: null, notes: '', createdAt: new Date().toISOString(),
  };
  db.cmsItems.push(item);
  saveDb();
  ok(res, { item });
});

app.post('/api/cms/items/:id/submit', requireRole('editor', 'admin'), (req, res) => {
  const db = getDb();
  const item = db.cmsItems.find((i) => i.id === req.params.id);
  if (!item) return bad(res, 'CMS', 'Item not found.', 404);
  if (item.status === 'published') return bad(res, 'CMS', 'Published items cannot be resubmitted.');
  item.status = 'in_review';
  item.submittedAt = new Date().toISOString();
  saveDb();
  ok(res, { item });
});

app.post('/api/cms/items/:id/review', requireRole('admin', 'editor'), (req, res) => {
  const db = getDb();
  if (!(req.user.role === 'admin' || req.user.permissions?.includes('approve'))) {
    return bad(res, 'APPROVE', 'Only an approver (admin / senior editor) can review.', 403);
  }
  const item = db.cmsItems.find((i) => i.id === req.params.id);
  if (!item) return bad(res, 'CMS', 'Item not found.', 404);
  const { approve, notes = '' } = req.body || {};
  item.status = approve ? 'approved' : 'rejected';
  item.reviewer = req.user.username || req.user.name;
  item.notes = notes;
  saveDb();
  ok(res, { item });
});

app.post('/api/cms/items/:id/publish', requireRole('admin', 'editor'), (req, res) => {
  const db = getDb();
  const item = db.cmsItems.find((i) => i.id === req.params.id);
  if (!item) return bad(res, 'CMS', 'Item not found.', 404);
  if (item.status !== 'approved') return bad(res, 'CMS', 'Only approved items can be published.');
  item.status = 'published';
  item.publishedAt = new Date().toISOString();
  // Publishing a note actually adds it to the topic content.
  db.content.push({
    id: newId('c'), type: item.type, title: item.title, body: item.body,
    minutes: 5, topicId: item.topicId, classId: db.topics.find((t) => t.id === item.topicId)?.classId,
    subjectId: db.topics.find((t) => t.id === item.topicId)?.subjectId,
    status: 'published', author: item.author, reviewer: item.reviewer,
    publishedAt: item.publishedAt, boards: ['cbse', 'icse', 'state', 'generic'],
  });
  saveDb();
  ok(res, { item });
});

/* ============================= billing ============================= */
app.get('/api/billing/plans', (req, res) => {
  const db = getDb();
  const s = db.settings;
  ok(res, {
    individual: {
      name: s.planName, price: s.planPrice, currency: s.planCurrency,
      period: 'month', billing: 'Monthly only',
      includes: ['All subjects', 'Unlimited quizzes', 'Full progress + parent dashboard', 'Certificates'],
      excludes: ['Family plan', 'Quarterly/yearly billing', 'Free trial of the paid plan'],
    },
    school: {
      ratePerStudentPerYear: s.schoolRatePerStudent,
      minimumFee: s.schoolMinFee,
      teachersFree: true,
      pilotDays: s.schoolPilotDays,
      includes: ['Teacher dashboards & class codes', 'Live group sessions', 'Class + student reports (PDF/Excel)', 'School-licensed students learn at school and at home'],
      examples: [
        { students: 50, fee: Math.max(50 * s.schoolRatePerStudent, s.schoolMinFee) },
        { students: 100, fee: Math.max(100 * s.schoolRatePerStudent, s.schoolMinFee) },
        { students: 300, fee: Math.max(300 * s.schoolRatePerStudent, s.schoolMinFee) },
        { students: 500, fee: Math.max(500 * s.schoolRatePerStudent, s.schoolMinFee) },
      ],
    },
    gstNote: s.gstNote,
    payment: { web: 'PhonePe PG', android: 'Google Play Billing', recurring: 'UPI AutoPay / e-mandate (PhonePe PG)' },
  });
});

app.post('/api/billing/subscribe', requireAuth, (req, res) => {
  const db = getDb();
  const method = req.body?.method === 'play' ? 'play' : 'phonepe';
  // Demo checkout — in production this is a PhonePe PG / Play Billing webhook.
  req.user.subscription = {
    status: 'active', plan: 'monthly', since: new Date().toISOString(),
    renewsAt: new Date(Date.now() + 30 * 86400000).toISOString(), method,
    invoice: `INV-${Date.now().toString(36).toUpperCase()}`,
  };
  saveDb();
  ok(res, {
    subscription: req.user.subscription,
    note: 'Demo checkout succeeded (no real payment). GST extra at checkout in production.',
  });
});

app.post('/api/billing/school-quote', (req, res) => {
  const db = getDb();
  const students = Math.max(1, Math.min(100000, Number(req.body?.students) || 100));
  const rate = db.settings.schoolRatePerStudent;
  const minFee = db.settings.schoolMinFee;
  const raw = students * rate;
  ok(res, {
    students, ratePerStudent: rate, rawAmount: raw,
    minimumFee: minFee, finalAmount: Math.max(raw, minFee),
    gstNote: db.settings.gstNote,
  });
});

/* ============================= admin ============================= */
app.get('/api/admin/overview', requireRole('admin'), (req, res) => {
  const db = getDb();
  ok(res, {
    users: db.users.map((u) => ({
      id: u.id, name: u.name, role: u.role, phone: u.phone,
      subscription: u.subscription?.status || 'none',
      trialSecondsLeft: trialLeft(u),
    })),
    counts: {
      users: db.users.length,
      profiles: db.profiles.length,
      subscribers: db.users.filter((u) => isSubscribed(u) && u.subscription.plan === 'monthly').length,
      schools: db.schools.length,
      schoolStudents: db.schools.reduce((s, x) => s + x.students, 0),
      content: db.content.length,
      inReview: db.cmsItems.filter((i) => i.status === 'in_review').length,
      certificates: db.certificates.length,
      liveSessions: db.sessions.length,
    },
    schools: db.schools,
    passMarks: db.passMarks,
    revenueNote: '1,000 paying parents × ₹149 ≈ ₹1,49,000/month before gateway & store fees (GST extra).',
  });
});

app.put('/api/admin/pass-marks', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { default: def, bySubject } = req.body || {};
  if (def) db.passMarks.default = Math.max(1, Math.min(100, Number(def)));
  if (bySubject && typeof bySubject === 'object') {
    db.passMarks.bySubject = { ...db.passMarks.bySubject, ...bySubject };
  }
  saveDb();
  ok(res, { passMarks: db.passMarks });
});

app.post('/api/admin/reset-demo', requireRole('admin'), (req, res) => {
  resetDb();
  ok(res, { ok: true });
});

/* ============================= static + health ============================= */
app.get('/api/health', (req, res) => ok(res, { ok: true, service: 'knowledge-bank-api', time: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 'SERVER', message: 'Something went wrong on the server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Knowledge Bank API listening on http://0.0.0.0:${PORT}`);
});
