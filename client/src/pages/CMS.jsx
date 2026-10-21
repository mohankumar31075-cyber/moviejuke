import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Spinner } from '../components/Layout.jsx';

const STATUS_PILL = {
  draft: 'gray', in_review: 'gold', approved: 'green', published: 'green', rejected: 'red',
};
const STATUS_LABEL = {
  draft: 'Draft', in_review: 'In review', approved: 'Approved', published: 'Published', rejected: 'Changes requested',
};

export default function CMS() {
  const { user, curriculum } = useApp();
  const [items, setItems] = useState([]);
  const [canApprove, setCanApprove] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', body: '', topicId: '', type: 'note', aiAssist: true });
  const [filter, setFilter] = useState('');

  const load = () => api.get(`/cms/items${filter ? `?status=${filter}` : ''}`)
    .then((r) => { setItems(r.items); setCanApprove(r.canApprove); })
    .catch((e) => setError(e.message));

  useEffect(() => { load(); }, [filter]);

  const act = async (fn) => {
    setError('');
    try { await fn(); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1 style={{ margin: '6px 0' }}>Content CMS ✍️</h1>
          <p className="muted" style={{ margin: 0 }}>
            Draft with AI assistance → submit → human review & approval → publish. Nothing goes live without approval.
          </p>
        </div>
        <span className={`pill ${canApprove ? 'green' : ''}`}>
          {canApprove ? '🛡️ Approver rights' : '📝 Editor access'}
        </span>
      </div>

      <div className="card mt-2">
        <h2 style={{ marginTop: 0 }}>New content</h2>
        <div className="grid grid-3">
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="note">📝 Note</option>
              <option value="video">🎬 Video</option>
              <option value="audio">🎧 Audio</option>
            </select>
          </div>
          <div className="field">
            <label>Topic</label>
            <select value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })}>
              <option value="">Choose topic…</option>
              {(curriculum?.classes || []).map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {(curriculum?.subjects || []).map((s) => (
                    <option key={`${c.id}-${s.id}`} value={`${c.id}|${s.id}`}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Adjectives — Level 2" />
          </div>
        </div>
        <div className="field">
          <label>Body</label>
          <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the content… or tick AI assist to scaffold a first draft." />
        </div>
        <div className="flex">
          <label className="flex" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={form.aiAssist} onChange={(e) => setForm({ ...form, aiAssist: e.target.checked })} />
            🤖 AI-assisted first draft
          </label>
          <button
            className="btn btn-primary"
            disabled={!form.title}
            onClick={() => act(async () => {
              await api.post('/cms/items', form);
              setForm({ title: '', body: '', topicId: '', type: 'note', aiAssist: true });
            })}
          >
            Save draft
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          AI drafts are always marked as AI-assisted and must pass human review before publishing (PRD §7).
        </p>
      </div>

      <div className="flex-between mt-3">
        <h2 style={{ margin: 0 }}>Pipeline</h2>
        <div className="chip-row">
          {['', 'draft', 'in_review', 'approved', 'published', 'rejected'].map((s) => (
            <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s === '' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!items.length && <Spinner />}
      <div className="stack mt-2">
        {items.map((it) => (
          <div key={it.id} className="card">
            <div className="flex-between">
              <div>
                <div className="flex">
                  <span className={`pill ${STATUS_PILL[it.status]}`}>{STATUS_LABEL[it.status]}</span>
                  <span className="pill gray">{{ note: '📝', video: '🎬', audio: '🎧' }[it.type] || '📄'} {it.type}</span>
                  {it.body?.includes('AI-assisted') && <span className="pill gold">🤖 AI-assisted</span>}
                </div>
                <h3 style={{ margin: '10px 0 4px' }}>{it.title}</h3>
                <div className="muted" style={{ fontSize: '0.88rem' }}>
                  by {it.author}
                  {it.submittedAt && ` · submitted ${new Date(it.submittedAt).toLocaleDateString('en-IN')}`}
                  {it.reviewer && ` · reviewed by ${it.reviewer}`}
                </div>
                {it.notes && <div className="banner info" style={{ marginTop: 10 }}><span>💬</span><div>{it.notes}</div></div>}
                <details style={{ marginTop: 8 }}>
                  <summary className="muted" style={{ cursor: 'pointer' }}>Preview body</summary>
                  <div className="body-note mt-2" style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{it.body}</div>
                </details>
              </div>
              <div className="stack">
                {(it.status === 'draft' || it.status === 'rejected') && (
                  <button className="btn btn-primary btn-sm" onClick={() => act(() => api.post(`/cms/items/${it.id}/submit`))}>
                    📤 Submit for review
                  </button>
                )}
                {it.status === 'in_review' && canApprove && (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => act(() => api.post(`/cms/items/${it.id}/review`, { approve: true, notes: 'Looks good.' }))}
                    >
                      ✅ Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        const notes = prompt('What should be fixed?') || 'Needs changes.';
                        return act(() => api.post(`/cms/items/${it.id}/review`, { approve: false, notes }));
                      }}
                    >
                      ↩️ Request changes
                    </button>
                  </>
                )}
                {it.status === 'approved' && (
                  <button className="btn btn-gold btn-sm" onClick={() => act(() => api.post(`/cms/items/${it.id}/publish`))}>
                    🚀 Publish
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!canApprove && items.some((i) => i.status === 'in_review') && (
        <div className="banner warn mt-2">
          <span>🛡️</span>
          <div>Only an approver (admin or senior editor) can approve/reject. Sign in as <b>admin / admin123</b> to see the approval step.</div>
        </div>
      )}
    </div>
  );
}
