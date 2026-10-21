import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner, Stat } from '../components/Layout.jsx';

export default function TeacherDash() {
  const { user, curriculum } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [reportFor, setReportFor] = useState(null);
  const [assign, setAssign] = useState({ quizId: '', classId: '' });
  const [newClass, setNewClass] = useState({ name: '', subjectId: 'math', classLevel: 'c4' });

  const load = () => api.get('/teacher/classes').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <Spinner />;

  const openReport = async (cls) => {
    const r = await api.get(`/teacher/classes/${cls.id}/report`);
    setReport(r);
    setReportFor(cls.id);
  };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 style={{ margin: '6px 0' }}>Teacher dashboard 👩‍🏫</h1>
          <p className="muted" style={{ margin: 0 }}>Classes, assignments, live sessions and performance reports.</p>
        </div>
        <span className="pill green">Teacher accounts are free</span>
      </div>

      <div className="grid grid-4 mt-2">
        <Stat num={data.classes.length} label="My classes" />
        <Stat num={data.classes.reduce((s, c) => s + c.students.length, 0)} label="Students" />
        <Stat num={data.classes.reduce((s, c) => s + c.assignments.length, 0)} label="Assignments" />
        <Stat num={data.quizzes.length} label="Quizzes available" />
      </div>

      {data.classes.map((cls) => (
        <div key={cls.id} className="card mt-3">
          <div className="flex-between">
            <div>
              <h2 style={{ margin: '0 0 4px' }}>{cls.name}</h2>
              <div className="muted">Class code: <b style={{ letterSpacing: 2, color: 'var(--purple)' }}>{cls.code}</b>
                {' '}· {cls.students.length} students · {curriculum?.subjects?.find((s) => s.id === cls.subjectId)?.name}</div>
            </div>
            <div className="flex">
              <button className="btn btn-ghost btn-sm" onClick={() => openReport(cls)}>📊 View report</button>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(`/teacher/classes/${cls.id}/report.csv`, `${cls.name}-report.csv`)}>⬇ CSV / Excel</button>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(`/teacher/classes/${cls.id}/report.pdf`, `${cls.name}-report.pdf`)}>⬇ PDF</button>
            </div>
          </div>

          <h3 className="mt-2">Students</h3>
          <div className="flex">
            {cls.students.map((s) => (
              <span key={s.id} className="chip">{s.avatar} {s.nickname}</span>
            ))}
            {cls.students.length === 0 && <span className="muted">No students yet — share the class code.</span>}
          </div>

          <h3 className="mt-2">Assignments</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Quiz</th><th>Due</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {cls.assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{new Date(a.due).toLocaleDateString('en-IN')}</td>
                    <td><span className="pill">{a.submitted}/{cls.students.length}</span></td>
                  </tr>
                ))}
                {cls.assignments.length === 0 && <tr><td colSpan={3} className="muted">No assignments yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex mt-2">
            <select
              className="chip"
              value={assign.classId === cls.id ? assign.quizId : ''}
              onChange={(e) => setAssign({ classId: cls.id, quizId: e.target.value })}
            >
              <option value="">Choose a quiz to assign…</option>
              {data.quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
            <button
              className="btn btn-primary btn-sm"
              disabled={assign.classId !== cls.id || !assign.quizId}
              onClick={async () => {
                await api.post(`/teacher/classes/${cls.id}/assign`, { quizId: assign.quizId });
                setAssign({ quizId: '', classId: '' });
                load();
              }}
            >
              📌 Assign quiz
            </button>
            <button
              className="btn btn-gold btn-sm"
              disabled={assign.classId !== cls.id || !assign.quizId}
              onClick={async () => {
                const r = await api.post('/sessions', { quizId: assign.quizId, scoring: 'speed', questionSeconds: 49, mode: 'live' });
                navigate(`/live/${r.session.code}`);
              }}
            >
              🎮 Host live session
            </button>
          </div>

          {reportFor === cls.id && report && (
            <div className="mt-3">
              <h3>📈 Class performance — {report.class.name}</h3>
              <div className="grid grid-4">
                <Stat num={report.summary.students} label="Students" />
                <Stat num={report.summary.attempts} label="Quiz attempts" />
                <Stat num={`${report.summary.avgPct}%`} label="Class average" />
                <Stat num={`${report.summary.passRate}%`} label="Pass rate (≥80%)" />
              </div>
              <div className="table-wrap mt-2">
                <table>
                  <thead>
                    <tr><th>Student</th><th>Nickname</th><th>Attempts</th><th>Avg %</th><th>Best %</th><th>Certificates</th></tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.profileId}>
                        <td>{r.name}</td><td>{r.nickname}</td><td>{r.attempts}</td>
                        <td>{r.avgPct}%</td><td>{r.bestPct}%</td><td>{r.certificates}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="card mt-3">
        <h2 style={{ marginTop: 0 }}>➕ Create a class</h2>
        <div className="grid grid-3">
          <div className="field">
            <label>Class name</label>
            <input value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} placeholder="e.g. Class 5 – Rockets" />
          </div>
          <div className="field">
            <label>Subject</label>
            <select value={newClass.subjectId} onChange={(e) => setNewClass({ ...newClass, subjectId: e.target.value })}>
              {(curriculum?.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Class level</label>
            <select value={newClass.classLevel} onChange={(e) => setNewClass({ ...newClass, classLevel: e.target.value })}>
              {(curriculum?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <button
          className="btn btn-primary"
          disabled={!newClass.name}
          onClick={async () => {
            await api.post('/teacher/classes', newClass);
            setNewClass({ name: '', subjectId: 'math', classLevel: 'c4' });
            load();
          }}
        >
          Create class & get code
        </button>
        <p className="muted mt-2" style={{ fontSize: '0.88rem' }}>
          Schools get a free {curriculum?.settings?.schoolPilotDays ?? 30}-day pilot.
          Licence: ₹{curriculum?.settings?.schoolRatePerStudent ?? 199} per student/year
          (minimum ₹{(curriculum?.settings?.schoolMinFee ?? 20000).toLocaleString('en-IN')}).
          <Link to="/pricing"> School pricing →</Link>
        </p>
      </div>
    </div>
  );
}
