// Knowledge Bank — demo accounts, history and platform seed data.
import crypto from 'node:crypto';
import {
  boards, classes, subjects, topics, contentItems, quizzes, questions,
} from './curriculum.js';

const now = Date.now();
const daysAgo = (d) => new Date(now - d * 86400000).toISOString();

export function buildSeed() {
  const users = [
    {
      id: 'u_parent', role: 'parent', name: 'Priya Sharma', phone: '9000000001',
      username: null, password: null, token: 'tok_parent',
      consentAt: daysAgo(30), consentVersion: 'DPDP-2026-01',
      trialSecondsTotal: 2700, trialSecondsUsed: 1260,
      subscription: { status: 'none', plan: null, since: null, renewsAt: null, method: null },
    },
    {
      id: 'u_teacher', role: 'teacher', name: 'Meena Iyer', phone: '9000000002',
      username: 'teacher.meena', password: 'teach123', token: 'tok_teacher',
      consentAt: daysAgo(60), consentVersion: 'DPDP-2026-01',
      trialSecondsTotal: 2700, trialSecondsUsed: 0,
      subscription: { status: 'active', plan: 'teacher', since: daysAgo(60), renewsAt: null, method: 'school' },
    },
    {
      id: 'u_editor', role: 'editor', name: 'Raj Verma', phone: '9000000003',
      username: 'editor.raj', password: 'edit123', token: 'tok_editor',
      consentAt: daysAgo(60), consentVersion: 'DPDP-2026-01',
      trialSecondsTotal: 2700, trialSecondsUsed: 0,
      subscription: { status: 'active', plan: 'staff', since: daysAgo(60), renewsAt: null, method: 'staff' },
    },
    {
      id: 'u_admin', role: 'admin', name: 'Asha Nair', phone: '9000000004',
      username: 'admin', password: 'admin123', token: 'tok_admin',
      consentAt: daysAgo(90), consentVersion: 'DPDP-2026-01',
      // Admin holds the approver permission and is the platform super-admin.
      permissions: ['approve', 'super-admin', 'billing'],
      trialSecondsTotal: 2700, trialSecondsUsed: 0,
      subscription: { status: 'active', plan: 'staff', since: daysAgo(90), renewsAt: null, method: 'staff' },
    },
    {
      id: 'u_parent2', role: 'parent', name: 'Suresh Kumar', phone: '9000000005',
      username: null, password: null, token: 'tok_parent2',
      consentAt: daysAgo(10), consentVersion: 'DPDP-2026-01',
      trialSecondsTotal: 2700, trialSecondsUsed: 2700,
      subscription: { status: 'active', plan: 'monthly', since: daysAgo(8), renewsAt: daysAgo(-22), method: 'phonepe' },
    },
  ];

  const profiles = [
    { id: 'p_aarav', userId: 'u_parent', name: 'Aarav', nickname: 'SpeedyAarav', classId: 'c2', pin: '1234', avatar: '🐯', schoolClassId: 'tc_sunshine', createdAt: daysAgo(30) },
    { id: 'p_diya', userId: 'u_parent', name: 'Diya', nickname: 'StarDiya', classId: 'c4', pin: '2468', avatar: '🦄', schoolClassId: null, createdAt: daysAgo(30) },
    { id: 'p_ishaan', userId: 'u_parent2', name: 'Ishaan', nickname: 'CoolIshaan', classId: 'c3', pin: '1111', avatar: '🚀', schoolClassId: null, createdAt: daysAgo(10) },
    // School students (teacher-created class roster)
    { id: 'p_rohan', userId: null, name: 'Rohan', nickname: 'RohanRocks', classId: 'c4', pin: null, avatar: '🦁', schoolClassId: 'tc_sunshine', createdAt: daysAgo(40) },
    { id: 'p_sara', userId: null, name: 'Sara', nickname: 'SunflowerSara', classId: 'c4', pin: null, avatar: '🌻', schoolClassId: 'tc_sunshine', createdAt: daysAgo(40) },
    { id: 'p_kabir', userId: null, name: 'Kabir', nickname: 'KabirKite', classId: 'c4', pin: null, avatar: '🪁', schoolClassId: 'tc_sunshine', createdAt: daysAgo(40) },
    { id: 'p_anaya', userId: null, name: 'Anaya', nickname: 'AnayaArrow', classId: 'c4', pin: null, avatar: '🏹', schoolClassId: 'tc_sunshine', createdAt: daysAgo(40) },
    { id: 'p_veer', userId: null, name: 'Veer', nickname: 'VeerVolt', classId: 'c4', pin: null, avatar: '⚡', schoolClassId: 'tc_sunshine', createdAt: daysAgo(40) },
    { id: 'p_meera', userId: null, name: 'Meera', nickname: 'MoonMeera', classId: 'c4', pin: null, avatar: '🌙', schoolClassId: 'tc_sunshine', createdAt: daysAgo(40) },
    { id: 'p_dev', userId: null, name: 'Dev', nickname: 'DynamoDev', classId: 'c4', pin: null, avatar: '🎯', schoolClassId: 'tc_sunshine', createdAt: daysAgo(40) },
  ];

  // Demo attempts: topic quizzes + one anytime quiz leaderboard
  const findQuiz = (classId, subjectId, i = 0) => quizzes.find((q) => {
    const t = topics.find((x) => x.id === q.topicId);
    return t.classId === classId && t.subjectId === subjectId;
  }) || quizzes[i];

  const zAdd = findQuiz('c2', 'eng');       // Verbs
  const zAdd2 = findQuiz('c2', 'math');     // Place value
  const zFractions = findQuiz('c4', 'math');// Fractions
  const zAdjectives = findQuiz('c4', 'eng');// Adjectives
  const zSolar = findQuiz('c3', 'gk');      // Solar system

  const attempts = [
    // Aarav — English (strong), Maths (needs practice)
    { id: 'at1', profileId: 'p_aarav', quizId: zAdd.id, correct: 3, total: 4, pct: 75, timeMs: 132000, date: daysAgo(12), mode: 'anytime', passed: false },
    { id: 'at2', profileId: 'p_aarav', quizId: zAdd.id, correct: 4, total: 4, pct: 100, timeMs: 110000, date: daysAgo(11), mode: 'anytime', passed: true },
    { id: 'at3', profileId: 'p_aarav', quizId: zAdd2.id, correct: 2, total: 4, pct: 50, timeMs: 150000, date: daysAgo(10), mode: 'anytime', passed: false },
    { id: 'at4', profileId: 'p_aarav', quizId: zAdd2.id, correct: 3, total: 4, pct: 75, timeMs: 128000, date: daysAgo(6), mode: 'anytime', passed: false },
    // Diya — Class 4
    { id: 'at5', profileId: 'p_diya', quizId: zFractions.id, correct: 4, total: 4, pct: 100, timeMs: 96000, date: daysAgo(8), mode: 'anytime', passed: true },
    { id: 'at6', profileId: 'p_diya', quizId: zAdjectives.id, correct: 3, total: 4, pct: 75, timeMs: 121000, date: daysAgo(5), mode: 'anytime', passed: false },
    { id: 'at7', profileId: 'p_diya', quizId: zAdjectives.id, correct: 4, total: 4, pct: 100, timeMs: 88000, date: daysAgo(4), mode: 'anytime', passed: true },
    // Ishaan (subscribed user's child) — GK
    { id: 'at8', profileId: 'p_ishaan', quizId: zSolar.id, correct: 4, total: 4, pct: 100, timeMs: 74000, date: daysAgo(3), mode: 'anytime', passed: true },
    // Class 4 — Fractions anytime leaderboard
    { id: 'at9', profileId: 'p_rohan', quizId: zFractions.id, correct: 3, total: 4, pct: 75, timeMs: 140000, date: daysAgo(7), mode: 'anytime', passed: false },
    { id: 'at10', profileId: 'p_sara', quizId: zFractions.id, correct: 4, total: 4, pct: 100, timeMs: 102000, date: daysAgo(7), mode: 'anytime', passed: true },
    { id: 'at11', profileId: 'p_kabir', quizId: zFractions.id, correct: 2, total: 4, pct: 50, timeMs: 175000, date: daysAgo(6), mode: 'anytime', passed: false },
    { id: 'at12', profileId: 'p_anaya', quizId: zFractions.id, correct: 4, total: 4, pct: 100, timeMs: 91000, date: daysAgo(6), mode: 'anytime', passed: true },
    { id: 'at13', profileId: 'p_veer', quizId: zFractions.id, correct: 3, total: 4, pct: 75, timeMs: 118000, date: daysAgo(5), mode: 'anytime', passed: true },
    { id: 'at14', profileId: 'p_meera', quizId: zFractions.id, correct: 3, total: 4, pct: 75, timeMs: 131000, date: daysAgo(5), mode: 'anytime', passed: true },
    { id: 'at15', profileId: 'p_dev', quizId: zFractions.id, correct: 4, total: 4, pct: 100, timeMs: 85000, date: daysAgo(4), mode: 'anytime', passed: true },
  ];

  const certificates = [
    { id: 'cert1', serial: 'KB-2026-0001', profileId: 'p_aarav', kind: 'pass', quizId: zAdd.id, title: 'Verbs — Action Words', pct: 100, date: daysAgo(11), source: 'Practice Quiz' },
    { id: 'cert2', serial: 'KB-2026-0002', profileId: 'p_diya', kind: 'pass', quizId: zFractions.id, title: 'Fractions Made Easy', pct: 100, date: daysAgo(8), source: 'Practice Quiz' },
    { id: 'cert3', serial: 'KB-2026-0003', profileId: 'p_diya', kind: 'top', quizId: zAdjectives.id, title: 'Adjectives & Comparisons — Live Challenge', pct: 100, date: daysAgo(4), source: 'Live Session KB-LIVE-72' },
  ];

  const teacherClasses = [
    {
      id: 'tc_sunshine', teacherId: 'u_teacher', name: 'Class 4 – Sunshine', subjectId: 'math',
      classLevel: 'c4', code: 'SUN7Q2', createdAt: daysAgo(45),
      studentIds: ['p_rohan', 'p_sara', 'p_kabir', 'p_anaya', 'p_veer', 'p_meera', 'p_dev', 'p_aarav'],
      assignments: [
        { id: 'as1', quizId: zFractions.id, title: 'Fractions Made Easy', due: daysAgo(-3), createdAt: daysAgo(9) },
        { id: 'as2', quizId: zAdjectives.id, title: 'Adjectives & Comparisons', due: daysAgo(-8), createdAt: daysAgo(2) },
      ],
    },
    {
      id: 'tc_stars', teacherId: 'u_teacher', name: 'Class 3 – Stars', subjectId: 'gk',
      classLevel: 'c3', code: 'STR4K8', createdAt: daysAgo(45),
      studentIds: ['p_ishaan'],
      assignments: [{ id: 'as3', quizId: zSolar.id, title: 'Our Solar System', due: daysAgo(-5), createdAt: daysAgo(7) }],
    },
  ];

  const sessions = [
    {
      id: 'sess_past1', code: 'KB72', hostId: 'u_teacher', classId: 'tc_sunshine',
      quizId: zAdjectives.id, mode: 'live', scoring: 'speed',
      questionSeconds: 49, status: 'finished', createdAt: daysAgo(4),
      players: [
        { profileId: 'p_diya', nickname: 'StarDiya', score: 3400, correct: 4 },
        { profileId: 'p_rohan', nickname: 'RohanRocks', score: 2900, correct: 3 },
        { profileId: 'p_sara', nickname: 'SunflowerSara', score: 2600, correct: 3 },
        { profileId: 'p_dev', nickname: 'DynamoDev', score: 2200, correct: 3 },
        { profileId: 'p_veer', nickname: 'VeerVolt', score: 1800, correct: 2 },
      ],
    },
    {
      id: 'sess_past2', code: 'KB55', hostId: 'u_teacher', classId: 'tc_stars',
      quizId: zSolar.id, mode: 'live', scoring: 'plain',
      questionSeconds: 49, status: 'finished', createdAt: daysAgo(2),
      players: [
        { profileId: 'p_ishaan', nickname: 'CoolIshaan', score: 400, correct: 4 },
        { profileId: 'p_meera', nickname: 'MoonMeera', score: 300, correct: 3 },
      ],
    },
  ];

  const cmsItems = [
    {
      id: 'cms1', type: 'note', topicId: topics[0].id, title: 'Sight Words — Level 2 (draft)',
      body: 'Once, upon, because, before… Level 2 sight words with example sentences.',
      status: 'in_review', author: 'editor.raj', submittedAt: daysAgo(2), reviewer: null, notes: '',
    },
    {
      id: 'cms2', type: 'note', topicId: topics[6].id, title: 'Healthy Teeth (draft)',
      body: 'Brush twice a day. Avoid too many sweets. Visit the dentist twice a year.',
      status: 'draft', author: 'editor.raj', submittedAt: null, reviewer: null, notes: '',
    },
    {
      id: 'cms3', type: 'note', topicId: topics[10].id, title: 'Counting Money (needs fixes)',
      body: 'Coins and notes, ₹1 to ₹500. Make sums with coins.',
      status: 'rejected', author: 'editor.raj', submittedAt: daysAgo(6), reviewer: 'admin', notes: 'Add worked examples with ₹ sums, then resubmit.',
    },
    {
      id: 'cms4', type: 'note', topicId: topics[14].id, title: 'Compass Directions (approved)',
      body: 'North, South, East, West. The Sun rises in the East.',
      status: 'approved', author: 'editor.raj', submittedAt: daysAgo(4), reviewer: 'admin', notes: 'Good to go.',
    },
  ];

  const schools = [
    {
      id: 'sch1', name: 'Greenwood Public School', city: 'Bengaluru',
      students: 300, ratePerStudent: 199, minFee: 20000,
      licenceFee: Math.max(300 * 199, 20000), status: 'pilot', pilotDaysLeft: 18,
      joinedAt: daysAgo(20),
    },
    {
      id: 'sch2', name: 'Little Star Academy', city: 'Pune',
      students: 50, ratePerStudent: 199, minFee: 20000,
      licenceFee: Math.max(50 * 199, 20000), status: 'pilot', pilotDaysLeft: 26,
      joinedAt: daysAgo(4),
    },
  ];

  // Progress + time-spent tracking per profile/topic
  const progress = [
    { profileId: 'p_aarav', topicId: zAdd.topicId, seconds: 620, openedAt: daysAgo(11) },
    { profileId: 'p_aarav', topicId: zAdd2.topicId, seconds: 780, openedAt: daysAgo(6) },
    { profileId: 'p_diya', topicId: zFractions.topicId, seconds: 540, openedAt: daysAgo(8) },
    { profileId: 'p_diya', topicId: zAdjectives.topicId, seconds: 460, openedAt: daysAgo(4) },
    { profileId: 'p_ishaan', topicId: zSolar.topicId, seconds: 380, openedAt: daysAgo(3) },
  ];

  return {
    version: 1,
    boards, classes, subjects,
    topics: topics.map(({ contents, quiz, ...t }) => t),
    content: contentItems,
    quizzes,
    questions,
    users,
    profiles,
    attempts,
    certificates,
    teacherClasses,
    sessions,
    cmsItems,
    schools,
    progress,
    passMarks: { default: 80, bySubject: { gk: 70 } },
    trial: { quizSecondsTotal: 2700, warningAtSeconds: 300 },
    counters: { cert: 3, attempt: 15, cms: 4 },
    settings: {
      planName: 'Knowledge Bank Monthly', planPrice: 149, planCurrency: 'INR',
      schoolRatePerStudent: 199, schoolMinFee: 20000, schoolPilotDays: 30,
      gstNote: 'Prices are exclusive of GST. GST is added at checkout / on school invoices.',
    },
  };
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}
