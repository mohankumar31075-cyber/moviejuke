import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner } from '../components/Layout.jsx';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export default function Pricing() {
  const { user, access, refresh } = useApp();
  const [plans, setPlans] = useState(null);
  const [students, setStudents] = useState(100);
  const [quote, setQuote] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/billing/plans').then(setPlans).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.post('/billing/school-quote', { students }).then(setQuote).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [students]);

  if (!plans) return <Spinner />;

  const subscribe = async (method) => {
    setMsg('');
    try {
      const r = await api.post('/billing/subscribe', { method });
      setMsg(`✅ ${r.note} Invoice ${r.subscription.invoice}.`);
      refresh();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <div>
      <div className="center">
        <h1 style={{ margin: '6px 0' }}>Simple, honest pricing</h1>
        <p className="muted">One family plan. One school rate. No confusing tiers. GST extra as required.</p>
      </div>

      <div className="grid grid-2 mt-3">
        <div className="card" style={{ border: '2.5px solid var(--purple)' }}>
          <div className="flex-between">
            <span className="pill">Individual</span>
            {access?.subscribed && <span className="pill green">Active ✓</span>}
          </div>
          <h2 style={{ fontSize: '2.4rem', margin: '10px 0 0' }}>
            {inr(plans.individual.price)}<span style={{ fontSize: '1rem', color: 'var(--muted)' }}> / month</span>
          </h2>
          <p className="muted">{plans.individual.name} · monthly billing only</p>
          <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
            {plans.individual.includes.map((x) => <li key={x}>✅ {x}</li>)}
          </ul>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Not included at launch: {plans.individual.excludes.join(' · ')}.
          </p>
          {user ? (
            <button className="btn btn-primary btn-block" disabled={access?.subscribed} onClick={() => subscribe('phonepe')}>
              {access?.subscribed ? 'Subscription active' : `Subscribe with PhonePe PG — ${inr(plans.individual.price)}/mo`}
            </button>
          ) : (
            <Link to="/login" className="btn btn-primary btn-block">Sign in to subscribe</Link>
          )}
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Web payments via PhonePe PG (UPI AutoPay / e-mandate for monthly repeats). In the Android app,
            Google Play Billing applies. {plans.gstNote}
          </p>
        </div>

        <div className="card">
          <div className="flex-between">
            <span className="pill gold">School licence</span>
            <span className="pill green">{plans.school.pilotDays}-day free pilot</span>
          </div>
          <h2 style={{ fontSize: '2.2rem', margin: '10px 0 0' }}>
            {inr(plans.school.ratePerStudentPerYear)}<span style={{ fontSize: '1rem', color: 'var(--muted)' }}> / student / year</span>
          </h2>
          <p className="muted">Minimum {inr(plans.school.minimumFee)} per school per year · teachers are always free</p>
          <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
            {plans.school.includes.map((x) => <li key={x}>✅ {x}</li>)}
          </ul>

          <div className="field">
            <label>How many students? — {students}</label>
            <input type="range" min={20} max={600} step={10} value={students} onChange={(e) => setStudents(Number(e.target.value))} />
          </div>
          {quote && (
            <div className="banner ok">
              <span>🏫</span>
              <div>
                <b>{quote.students} students × {inr(quote.ratePerStudent)} = {inr(quote.rawAmount)}</b>
                {quote.rawAmount < quote.minimumFee && <> — below minimum, so the fee is the {inr(quote.minimumFee)} minimum</>}
                {quote.rawAmount >= quote.minimumFee && <> (final amount)</>}
              </div>
            </div>
          )}

          <div className="table-wrap mt-2">
            <table>
              <thead><tr><th>Students</th><th>Annual fee</th></tr></thead>
              <tbody>
                {plans.school.examples.map((ex) => (
                  <tr key={ex.students}><td>{ex.students}</td><td><b>{inr(ex.fee)}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>{plans.gstNote}</p>
        </div>
      </div>

      {msg && <div className="alert success mt-2">{msg}</div>}

      <div className="card mt-3">
        <h2 style={{ marginTop: 0 }}>What stays free forever</h2>
        <div className="grid grid-3">
          <div>
            <b>📖 Browse everything</b>
            <p className="muted">Notes, videos and audio lessons — no login needed, for every class and subject.</p>
          </div>
          <div>
            <b>📝 English & GK quizzes</b>
            <p className="muted">Practice and earn certificates in the free subjects, always.</p>
          </div>
          <div>
            <b>🎁 One-time quiz trial</b>
            <p className="muted">
              New accounts get 30–60 minutes of trial quiz time across all subjects (server-counted, with a
              visible countdown and a soft warning before it ends). Progress and certificates are kept after the trial.
            </p>
          </div>
        </div>
        <div className="banner info mt-2">
          <span>🛡️</span>
          <div>
            Abuse prevention: one trial per phone number and per child profile. Certificates for free users are
            limited to free subjects and the free-trial window.
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <h2 style={{ marginTop: 0 }}>Payment & compliance notes</h2>
        <div className="grid grid-2">
          <div>
            <b>💳 Payments</b>
            <p className="muted">
              PhonePe PG on the web, Google Play Billing in the Android app. Recurring monthly payments in India
              follow UPI AutoPay / e-mandate rules. {plans.payment.recurring}
            </p>
          </div>
          <div>
            <b>🧾 GST</b>
            <p className="muted">{plans.gstNote} Applicable rate & registration to be confirmed with a CA.</p>
          </div>
          <div>
            <b>🔐 Children's data (DPDP)</b>
            <p className="muted">Verifiable parental consent is captured at the parent account level; deletion requests honoured.</p>
          </div>
          <div>
            <b>🚀 Later</b>
            <p className="muted">
              Worksheet packs and premium quiz sets (₹19–₹29 each), family/yearly tiers after retention data,
              classes beyond Class 5, and iOS after launch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
