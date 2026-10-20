'use strict';

(() => {
  /* =========================================================
     Helpers
     ========================================================= */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const esc = (value) =>
    String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const inr = (n) =>
    `₹${Math.round(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const inrCompact = (n) => {
    const value = Number(n) || 0;
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(value >= 1e8 ? 1 : 2).replace(/\.0+$/, '')} Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(1).replace(/\.0$/, '')} L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
    return `₹${value}`;
  };

  const compact = (n) => {
    const value = Number(n) || 0;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
    return String(value);
  };

  const pct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;

  const initials = (name) =>
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase();

  const toneIndex = (name) => {
    let hash = 0;
    const str = String(name || '');
    for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) % 997;
    return (hash % 5) + 1;
  };

  const avatarHtml = (name, size = '') =>
    `<span class="avatar ${size} avatar--t${toneIndex(name)}">${esc(initials(name))}</span>`;

  const fmtDate = (iso, withYear = false) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  };

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  };

  const timeAgo = (iso) => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diff = Date.now() - then;
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.round(months / 12)}y ago`;
  };

  const debounce = (fn, wait = 250) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const STAGE_LABELS = {
    new: 'New enquiry',
    contacted: 'Contacted',
    qualified: 'Qualified',
    quoted: 'Quote sent',
    won: 'Won',
    lost: 'Lost',
  };

  const SOURCE_LABELS = {
    google_ads: 'Google Ads',
    google_organic: 'Organic',
    google_shopping: 'Shopping',
    direct: 'Direct',
    referral: 'Referral',
    social: 'Social',
    whatsapp: 'WhatsApp',
    walk_in: 'Walk-in',
  };

  const stagePill = (stage) =>
    `<span class="pill pill--${esc(stage)} pill--dot">${esc(STAGE_LABELS[stage] || stage)}</span>`;

  const sourcePill = (source) =>
    `<span class="pill pill--${esc(source)}">${esc(SOURCE_LABELS[source] || source.replace(/_/g, ' '))}</span>`;

  const sourceText = (source) => esc(SOURCE_LABELS[source] || String(source || 'Unknown').replace(/_/g, ' '));

  /* =========================================================
     State
     ========================================================= */
  const state = {
    view: 'overview',
    rangeDays: 30,
    chartMetric: 'searchCustomers',
    overview: null,
    reference: { products: [], cities: [], stages: [], sources: [] },
    terms: [],
    termLookup: new Map(),
    productLookup: new Map(),
    customerFilters: {
      q: '',
      productId: '',
      source: '',
      city: '',
      from: '',
      to: '',
      stages: [],
      termId: '',
      sort: 'newest',
      page: 1,
      pageSize: 12,
    },
    queryFilters: { q: '', productId: '', source: '', sort: 'leads' },
    customerResult: null,
    queryResult: null,
    openCustomerId: null,
  };

  /* =========================================================
     API
     ========================================================= */
  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      payload = { error: text || 'Unexpected response' };
    }
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  const toast = (message, isError = false) => {
    const el = $('#toast');
    el.textContent = message;
    el.classList.toggle('is-error', isError);
    el.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  };

  /* =========================================================
     Routing
     ========================================================= */
  const VIEWS = ['overview', 'queries', 'customers', 'data'];

  function routeFromHash() {
    const hash = (location.hash || '').replace(/^#\/?/, '');
    return VIEWS.includes(hash) ? hash : 'overview';
  }

  function navigate(view) {
    if (!VIEWS.includes(view)) view = 'overview';
    state.view = view;
    $$('.view').forEach((section) => section.classList.toggle('is-active', section.dataset.view === view));
    $$('.nav-item[data-view]').forEach((link) => link.classList.toggle('is-active', link.dataset.view === view));
    $('#sidebar').classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (view === 'customers') loadCustomers();
    if (view === 'queries') loadQueries();
    if (view === 'overview' && state.overview) renderChart();
  }

  window.addEventListener('hashchange', () => {
    const view = routeFromHash();
    if (view !== state.view) navigate(view);
  });

  /* =========================================================
     Reference data
     ========================================================= */
  async function loadReference() {
    const ref = await api('/api/reference');
    state.reference = ref;
    const isReal = ref.dataMode === 'real';
    if (isReal && !state.historyDefaultApplied) {
      state.customerFilters.from = $('#history-from').value;
      state.customerFilters.to = $('#history-to').value;
      $('#c-from').value = state.customerFilters.from;
      $('#c-to').value = state.customerFilters.to;
    }
    if (isReal) state.historyDefaultApplied = true;
    $('#workspace-label').textContent = isReal ? 'Private workspace' : 'Demo workspace';
    $('#workspace-note').textContent = isReal
      ? `${ref.customerCount} enquiries · ${ref.termCount} search terms. Keep this workspace private.`
      : `${ref.customerCount} sample enquiries across ${ref.termCount} example searches.`;
    $('#replace-panel').hidden = isReal;
    $('#history-status').textContent = isReal
      ? `Real-data workspace · ${ref.customerCount} customer records · ${ref.searchCoverage.rows} dated search rows${ref.searchCoverage.first ? ` (${ref.searchCoverage.first} – ${ref.searchCoverage.last})` : ''}. Import files below to populate the requested period.`
      : 'Demo data only. No historical exports have been provided. Do not upload private customer data to this public preview; configure password protection on a private deployment first.';
    state.productLookup = new Map(ref.products.map((p) => [String(p.id), p]));
    $('#nav-term-count').textContent = ref.termCount;
    $('#nav-customer-count').textContent = ref.customerCount;

    const productOptions = ref.products
      .map((p) => `<option value="${p.id}">${esc(p.name)} · ${p.customers}</option>`)
      .join('');
    ['#q-product', '#c-product', '#add-product'].forEach((selector) => {
      const select = $(selector);
      const current = select.value;
      select.innerHTML = `<option value="">${selector === '#add-product' ? 'Not sure yet' : 'All products'}</option>${productOptions}`;
      select.value = current;
    });

    const citySelect = $('#c-city');
    const currentCity = citySelect.value;
    citySelect.innerHTML = `<option value="">All cities</option>${ref.cities
      .map((c) => `<option value="${esc(c.value)}">${esc(c.value)} · ${c.count}</option>`)
      .join('')}`;
    citySelect.value = currentCity;

    renderStageChips();
    await loadHistory();
  }

  /* =========================================================
     Overview
     ========================================================= */
  async function loadOverview() {
    state.overview = await api(`/api/overview?days=${state.rangeDays}`);
    renderOverview();
  }

  function renderOverview() {
    if (!state.overview) return;
    renderKpis();
    renderChart();
    renderFunnel();
    renderTopTerms();
    renderAttention();
    renderProductBars();

    const { range, kpis } = state.overview;
    const from = new Date(range.from);
    const to = new Date(range.to);
    $('#overview-sub').textContent = `${kpis.customers} customers in the book · ${kpis.newCustomers} arrived ${fmtDate(from)} – ${fmtDate(to)} · every one traced to a Google search where possible.`;
    $('#chart-sub').textContent = `Last ${state.rangeDays} days of enquiries · all imported reports: ${compact(kpis.impressions)} impressions → ${compact(kpis.clicks)} clicks`;
  }

  const sparkline = (values, stroke = '#2f6a5f') => {
    const data = values.length ? values : [0, 0];
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const width = 74;
    const height = 26;
    const stepX = width / Math.max(1, data.length - 1);
    const points = data
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / (max - min || 1)) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    </svg>`;
  };

  function renderKpis() {
    const { kpis, daily } = state.overview;
    const sparkCustomers = daily.map((d) => d.customers);
    const sparkPipeline = daily.map((d) => d.pipeline);
    const sparkSearch = daily.map((d) => d.searchCustomers);
    const searchShare = kpis.customers ? (kpis.searchCustomers / kpis.customers) * 100 : 0;

    const cards = [
      {
        label: 'Customers captured',
        value: String(kpis.customers),
        foot: `<span class="delta">+${kpis.newCustomers}</span> new in the last ${state.rangeDays} days`,
        spark: sparkline(sparkCustomers, '#2f6a5f'),
        accent: false,
      },
      {
        label: 'Open pipeline',
        value: inrCompact(kpis.pipeline),
        foot: `${inrCompact(kpis.newPipeline)} quoted in the last ${state.rangeDays} days`,
        spark: sparkline(sparkPipeline, '#b9763a'),
        accent: true,
      },
      {
        label: 'Bookings won',
        value: String(kpis.won),
        foot: `${inrCompact(kpis.revenue)} booked · ${inrCompact(kpis.avgDeal)} average`,
        spark: '',
        accent: false,
      },
      {
        label: 'Traced to a search',
        value: pct(searchShare, 0),
        foot: `${kpis.searchCustomers} of ${kpis.customers} customers have a Google query`,
        spark: sparkline(sparkSearch, '#2f6a5f'),
        accent: true,
      },
    ];

    $('#kpis').innerHTML = cards
      .map(
        (card) => `<article class="kpi ${card.accent ? 'kpi--accent' : ''}">
          <p class="kpi-label">${esc(card.label)}</p>
          <p class="kpi-value">${esc(card.value)}</p>
          <p class="kpi-foot">${card.foot}</p>
          ${card.spark ? `<div class="kpi-spark">${card.spark}</div>` : ''}
        </article>`,
      )
      .join('');
  }

  function renderChart() {
    const container = $('#chart');
    if (!container || !state.overview) return;

    const metric = state.chartMetric;
    const data = state.overview.daily;
    const values = data.map((d) => Number(d[metric]) || 0);
    const isCurrency = metric === 'pipeline';

    const width = Math.max(320, container.clientWidth || 640);
    const height = 268;
    const pad = { top: 14, right: 10, bottom: 28, left: isCurrency ? 52 : 40 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const rawMax = Math.max(...values, 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const niceMax = Math.ceil(rawMax / (magnitude / 2)) * (magnitude / 2);
    const max = niceMax || 1;

    const x = (i) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v) => pad.top + innerH * (1 - Math.min(v, max) / max);

    // Smooth path (Catmull-Rom → cubic bezier)
    const pts = values.map((v, i) => [x(i), y(v)]);
    let line = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      line += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    const area = `${line} L ${x(data.length - 1)} ${pad.top + innerH} L ${x(0)} ${pad.top + innerH} Z`;

    const ticks = 4;
    let gridLines = '';
    for (let i = 0; i <= ticks; i += 1) {
      const value = (max / ticks) * i;
      const gy = y(value);
      gridLines += `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" stroke="#eeebe3" stroke-width="1" ${i === 0 ? 'stroke-opacity="1"' : ''}/>`;
      const label = isCurrency ? inrCompact(value) : compact(Math.round(value));
      gridLines += `<text x="${pad.left - 9}" y="${gy + 3.5}" text-anchor="end" font-size="9.5" fill="#93a09b" font-family="Inter, sans-serif">${esc(label)}</text>`;
    }

    const labelEvery = Math.max(1, Math.ceil(data.length / 6));
    let xLabels = '';
    data.forEach((d, i) => {
      if (i % labelEvery !== 0 && i !== data.length - 1) return;
      const date = new Date(`${d.date}T00:00:00`);
      xLabels += `<text x="${x(i)}" y="${height - 8}" text-anchor="middle" font-size="9.5" fill="#93a09b" font-family="Inter, sans-serif">${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>`;
    });

    const gradientId = `chartGradient-${metric}`;
    const total = values.reduce((a, b) => a + b, 0);

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Trend of ${esc(metric)} over the last ${data.length} days">
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2f6a5f" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#2f6a5f" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${area}" fill="url(#${gradientId})"/>
        <path d="${line}" fill="none" stroke="#2a6157" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="chart-hover" style="opacity:0">
          <line class="hover-line" x1="0" y1="${pad.top}" x2="0" y2="${pad.top + innerH}" stroke="#b9763a" stroke-width="1" stroke-dasharray="3 3"/>
          <circle class="hover-dot" r="4.5" fill="#fff" stroke="#b9763a" stroke-width="2"/>
        </g>
        <rect x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" fill="transparent" class="chart-hit"/>
      </svg>
      <div class="chart-tooltip" id="chart-tooltip"></div>
    `;

    const svg = $('svg', container);
    const hover = $('.chart-hover', container);
    const hoverLine = $('.hover-line', container);
    const hoverDot = $('.hover-dot', container);
    const tooltip = $('#chart-tooltip', container);
    const hit = $('.chart-hit', container);

    const labelFor = (v) => (isCurrency ? inr(v) : `${v} ${metric === 'qualified' ? 'qualified' : 'enquiries'}`);

    hit.addEventListener('mousemove', (event) => {
      const rect = svg.getBoundingClientRect();
      const scale = width / rect.width;
      const localX = (event.clientX - rect.left) * scale;
      const ratio = (localX - pad.left) / (innerW || 1);
      const index = Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
      const px = x(index);
      const py = y(values[index]);

      hover.style.opacity = '1';
      hoverLine.setAttribute('x1', px);
      hoverLine.setAttribute('x2', px);
      hoverDot.setAttribute('cx', px);
      hoverDot.setAttribute('cy', py);

      const date = new Date(`${data[index].date}T00:00:00`);
      tooltip.innerHTML = `<strong>${isCurrency ? inr(values[index]) : values[index]}</strong><span>${date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>`;
      tooltip.style.left = `${(px / width) * rect.width}px`;
      tooltip.style.top = `${(py / height) * rect.height - 10}px`;
      tooltip.classList.add('is-visible');
    });

    hit.addEventListener('mouseleave', () => {
      hover.style.opacity = '0';
      tooltip.classList.remove('is-visible');
    });

    if (total === 0) {
      container.insertAdjacentHTML(
        'beforeend',
        '<div class="chart-empty">No enquiries in this window yet.</div>',
      );
    }
  }

  function renderFunnel() {
    const steps = state.overview.funnel;
    const max = Math.max(...steps.map((s) => s.value), 1);
    const logMax = Math.log10(max + 1);

    $('#funnel').innerHTML = steps
      .map((step, index) => {
        const width = Math.max(3, (Math.log10(step.value + 1) / logMax) * 100);
        const prev = index > 0 ? steps[index - 1].value : null;
        const rate = prev ? (step.value / prev) * 100 : null;
        return `<li class="funnel-step">
          <div class="funnel-head">
            <span class="funnel-label">${esc(step.label)}
              ${rate !== null ? `<span class="funnel-rate">${pct(rate, rate < 10 ? 1 : 0)}</span>` : ''}
            </span>
            <span class="funnel-value">${step.key === 'impressions' || step.key === 'clicks' ? compact(step.value) : step.value.toLocaleString('en-IN')}</span>
          </div>
          <div class="funnel-track"><div class="funnel-bar" style="width:${width.toFixed(1)}%"></div></div>
        </li>`;
      })
      .join('');
  }

  function rememberTerms(rows) {
    rows.forEach((row) => state.termLookup.set(String(row.id), row.keyword));
  }

  function renderTopTerms() {
    const rows = state.overview.topTerms;
    rememberTerms(rows);
    const container = $('#term-table');
    if (!rows.length) {
      container.innerHTML = '<div class="empty-state"><strong>No search data yet</strong><p>Import a CSV with a keyword column to see queries here.</p></div>';
      return;
    }
    container.innerHTML = `<table>
      <thead><tr>
        <th class="cell-term">Search term</th>
        <th class="hide-sm">Source</th>
        <th class="num">Clicks</th>
        <th class="num">Customers</th>
        <th class="num">Pipeline</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (row) => `<tr class="is-clickable" data-term-id="${row.id}">
              <td class="cell-term">
                <div class="term-main">${esc(row.keyword)} <svg class="icon icon--tiny"><use href="#i-arrow-up-right"/></svg></div>
                <div class="term-sub">${esc(row.productName || 'Unmatched')} · ${esc(row.landingPage || '—')}</div>
              </td>
              <td class="hide-sm">${sourcePill(row.source)}</td>
              <td class="num">${row.clicks.toLocaleString('en-IN')}</td>
              <td class="num num-strong">${row.leads}</td>
              <td class="num">${inrCompact(row.pipeline)}</td>
              <td class="num"><svg class="icon icon--tiny" style="color:#93a09b"><use href="#i-chevron-right"/></svg></td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

    $$('tr[data-term-id]', container).forEach((row) => {
      row.addEventListener('click', () => filterByTerm(Number(row.dataset.termId)));
    });
  }

  function renderAttention() {
    const rows = state.overview.attention;
    const container = $('#attention');
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state" style="padding:34px 16px;border:0;background:transparent">
        <strong>All caught up</strong><p>No new enquiries have been waiting more than 36 hours.</p></div>`;
      return;
    }
    container.innerHTML = rows
      .map((row) => {
        const ageHours = Math.max(0, Math.round((Date.now() - new Date(row.createdAt).getTime()) / 3600000));
        return `<button class="attention-item" data-customer-id="${row.id}">
          ${avatarHtml(row.name, 'avatar--sm')}
          <span class="attention-body">
            <span class="attention-name">${esc(row.name)}</span>
            <span class="attention-query">${esc(row.keyword ? `“${row.keyword}”` : row.productName || 'No search query')}</span>
          </span>
          <span class="attention-age">${ageHours}h</span>
          <svg class="icon icon--tiny"><use href="#i-chevron-right"/></svg>
        </button>`;
      })
      .join('');

    $$('.attention-item', container).forEach((button) => {
      button.addEventListener('click', () => openCustomer(Number(button.dataset.customerId)));
    });
  }

  function renderProductBars() {
    const rows = state.overview.topProducts;
    const max = Math.max(...rows.map((r) => r.customers), 1);
    $('#product-bars').innerHTML = rows
      .map(
        (row) => `<div class="pbar-row">
          <div class="pbar-head">
            <span class="pbar-name">${esc(row.name)}</span>
            <span class="pbar-val">${row.customers} customers · ${inrCompact(row.pipeline)}</span>
          </div>
          <div class="pbar-track"><div class="pbar-fill" style="width:${((row.customers / max) * 100).toFixed(1)}%"></div></div>
        </div>`,
      )
      .join('');
  }

  /* =========================================================
     Search queries view
     ========================================================= */
  async function loadQueries() {
    const params = new URLSearchParams();
    const { q, productId, source, sort } = state.queryFilters;
    if (q) params.set('q', q);
    if (productId) params.set('productId', productId);
    if (source) params.set('source', source);
    params.set('sort', sort);

    const result = await api(`/api/search-terms?${params.toString()}`);
    state.queryResult = result;
    state.terms = result.rows;
    rememberTerms(result.rows);
    renderQuerySummary();
    renderQueryTable();
  }

  function renderQuerySummary() {
    const t = state.queryResult ? state.queryResult.totals : null;
    if (!t) return;
    const rate = t.clicks ? (t.leads / t.clicks) * 100 : 0;
    const cells = [
      ['Search queries', String(state.queryResult.count)],
      ['Impressions', compact(t.impressions)],
      ['Clicks', compact(t.clicks)],
      ['Customers', String(t.leads)],
      ['Click → customer', pct(rate, 2)],
    ];
    $('#q-summary').innerHTML = cells
      .map(([label, value]) => `<div class="summary-cell"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`)
      .join('');
  }

  function renderQueryTable() {
    const rows = state.queryResult ? state.queryResult.rows : [];
    const container = $('#q-table');
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state"><strong>No queries match those filters</strong><p>Try clearing the search box or picking a different product.</p></div>`;
      return;
    }

    const columns = [
      { key: 'clicks', label: 'Clicks', num: true },
      { key: 'ctr', label: 'CTR', num: true },
      { key: 'leads', label: 'Customers', num: true },
      { key: 'conversion', label: 'Conv.', num: true },
      { key: 'pipeline', label: 'Pipeline', num: true },
    ];
    const sortedKey = state.queryFilters.sort;

    container.innerHTML = `<table>
      <thead><tr>
        <th class="cell-term">Search term</th>
        <th class="hide-sm">Source</th>
        <th class="num hide-sm">Impressions</th>
        ${columns
          .map(
            (col) => `<th class="num sortable ${sortedKey === col.key ? 'is-sorted' : ''}" data-sort="${col.key}">${col.label}${sortedKey === col.key ? '<span class="sort-caret">▾</span>' : ''}</th>`,
          )
          .join('')}
        <th></th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (row) => `<tr class="is-clickable" data-term-id="${row.id}">
              <td class="cell-term">
                <div class="term-main">${esc(row.keyword)} <svg class="icon icon--tiny"><use href="#i-arrow-up-right"/></svg></div>
                <div class="term-sub">${esc(row.productName || 'Unmatched')}</div>
              </td>
              <td class="hide-sm">${sourcePill(row.source)}</td>
              <td class="num hide-sm">${row.impressions.toLocaleString('en-IN')}</td>
              <td class="num">${row.clicks.toLocaleString('en-IN')}</td>
              <td class="num">${row.ctr.toFixed(1)}%</td>
              <td class="num num-strong">${row.leads}</td>
              <td class="num">
                <span class="ctr-bar">${pct(row.conversion, row.conversion < 1 ? 2 : 1)}</span>
              </td>
              <td class="num">${inrCompact(row.pipeline)}</td>
              <td class="num"><svg class="icon icon--tiny" style="color:#93a09b"><use href="#i-chevron-right"/></svg></td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

    $$('tr[data-term-id]', container).forEach((row) => {
      row.addEventListener('click', () => filterByTerm(Number(row.dataset.termId)));
    });
    $$('th[data-sort]', container).forEach((th) => {
      th.addEventListener('click', () => {
        state.queryFilters.sort = th.dataset.sort;
        $('#q-sort').value = th.dataset.sort;
        loadQueries();
      });
    });
  }

  function filterByTerm(termId) {
    state.customerFilters.termId = String(termId);
    state.customerFilters.page = 1;
    state.customerFilters.stages = [];
    state.customerFilters.q = '';
    state.customerFilters.productId = '';
    state.customerFilters.source = '';
    state.customerFilters.city = '';
    $('#c-search').value = '';
    $('#c-product').value = '';
    $('#c-source').value = '';
    $('#c-city').value = '';
    location.hash = '#/customers';
    if (state.view === 'customers') loadCustomers();
  }

  /* =========================================================
     Customers view
     ========================================================= */
  function renderStageChips() {
    const container = $('#stage-chips');
    if (!container || !state.reference.stages) return;
    const active = state.customerFilters.stages;
    container.innerHTML = state.reference.stages
      .map(
        (stage) => `<button class="stage-chip ${active.includes(stage.value) ? 'is-active' : ''}" data-stage="${stage.value}">
          <span class="tick"><svg><use href="#i-check"/></svg></span>
          ${esc(stage.label)} <em>${stage.count}</em>
        </button>`,
      )
      .join('');
    $$('.stage-chip', container).forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.stage;
        const set = new Set(state.customerFilters.stages);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        state.customerFilters.stages = Array.from(set);
        state.customerFilters.page = 1;
        renderStageChips();
        loadCustomers();
      });
    });
  }

  function renderActiveFilters() {
    const chips = [];
    const f = state.customerFilters;
    if (f.termId) {
      chips.push({ key: 'termId', label: `Search: “${state.termLookup.get(f.termId) || 'term'}”` });
    }
    if (f.q) chips.push({ key: 'q', label: `Text: ${f.q}` });
    if (f.productId) {
      const product = state.productLookup.get(String(f.productId));
      chips.push({ key: 'productId', label: `Product: ${product ? product.name : f.productId}` });
    }
    if (f.source) chips.push({ key: 'source', label: `Source: ${SOURCE_LABELS[f.source] || f.source}` });
    if (f.city) chips.push({ key: 'city', label: `City: ${f.city}` });

    const container = $('#active-chips');
    if (!chips.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = chips
      .map(
        (chip) => `<span class="filter-chip">${esc(chip.label)}
          <button data-clear="${chip.key}" aria-label="Remove filter">${'<svg class="icon icon--tiny"><use href="#i-x"/></svg>'}</button>
        </span>`,
      )
      .join('');

    $$('button[data-clear]', container).forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.clear;
        state.customerFilters[key] = '';
        if (key === 'q') {
          $('#c-search').value = '';
          $('#global-search').value = '';
        }
        if (key === 'productId') $('#c-product').value = '';
        if (key === 'source') $('#c-source').value = '';
        if (key === 'city') $('#c-city').value = '';
        state.customerFilters.page = 1;
        renderActiveFilters();
        loadCustomers();
      });
    });
  }

  async function loadCustomers() {
    const f = state.customerFilters;
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.productId) params.set('productId', f.productId);
    if (f.source) params.set('source', f.source);
    if (f.city) params.set('city', f.city);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    if (f.termId) params.set('termId', f.termId);
    if (f.stages.length) params.set('stage', f.stages.join(','));
    params.set('sort', f.sort);
    params.set('page', String(f.page));
    params.set('pageSize', String(f.pageSize));

    const grid = $('#customer-grid');
    if (!grid.children.length) {
      grid.innerHTML = Array.from({ length: 6 })
        .map(() => '<div class="skeleton" style="height:186px;border-radius:16px"></div>')
        .join('');
    }

    try {
      const result = await api(`/api/customers?${params.toString()}`);
      state.customerResult = result;
      state.customerFilters.page = result.page;
      renderCustomerGrid();
      renderPagination();
      renderActiveFilters();

      const f2 = state.customerFilters;
      const filtered = Boolean(f2.q || f2.productId || f2.source || f2.city || f2.from || f2.to || f2.termId || f2.stages.length);
      $('#c-sub').textContent = filtered
        ? `${result.total} customers match these filters · ${state.reference.customerCount} in total`
        : `${result.total} customers, each with the search that brought them in.`;
    } catch (error) {
      grid.innerHTML = `<div class="empty-state"><strong>Could not load customers</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  function renderCustomerGrid() {
    const result = state.customerResult;
    const container = $('#customer-grid');
    if (!result || !result.rows.length) {
      container.innerHTML = `<div class="empty-state">
        <strong>No customers match those filters</strong>
        <p>Try a different product, source or stage — or clear the filters to see all ${state.reference.customerCount} records.</p>
      </div>`;
      return;
    }

    container.innerHTML = result.rows
      .map((row) => {
        const hasQuery = Boolean(row.keyword);
        const amount = row.quoteValue || row.budget;
        return `<button class="cust-card" data-customer-id="${row.id}">
          <span class="cust-top">
            <span class="cust-ident">
              ${avatarHtml(row.name)}
              <span style="min-width:0;overflow:hidden">
                <span class="cust-name">${esc(row.name)}</span>
                <span class="cust-sub">MJ-${String(row.id).padStart(4, '0')} · ${esc(row.city || 'Unknown city')}</span>
              </span>
            </span>
            ${stagePill(row.stage)}
          </span>
          <span class="cust-search ${hasQuery ? '' : 'cust-search--none'}">
            <span class="q-label">
              <svg class="icon icon--tiny" style="width:11px;height:11px"><use href="#i-search"/></svg>
              ${hasQuery ? 'Googled before enquiring' : 'No search query captured'}
            </span>
            <span class="q-term ${hasQuery ? '' : 'q-term--none'}">${hasQuery ? `“${esc(row.keyword)}”` : 'Walk-in, referral or direct visit'}</span>
            <span class="q-meta">
              ${row.productName ? `<span class="pill pill--product">${esc(row.productName)}</span>` : ''}
              ${hasQuery ? `<span class="src">${sourceText(row.source)}</span>` : ''}
            </span>
          </span>
          <span class="cust-foot">
            <span class="cust-fact">
              <span class="foot-label">${row.stage === 'won' ? 'Booked' : row.quoteValue ? 'Quote' : 'Budget'}</span>
              <span class="foot-value foot-value--amount">${amount ? inr(amount) : '—'}</span>
            </span>
            <span class="cust-fact">
              <span class="foot-label">Owner</span>
              <span class="foot-value">${esc(row.owner || 'Unassigned')}</span>
            </span>
            <span class="cust-fact spacer">
              <span class="foot-label">Added</span>
              <span class="foot-value">${fmtDate(row.createdAt)}</span>
            </span>
          </span>
        </button>`;
      })
      .join('');

    $$('.cust-card', container).forEach((card) => {
      card.addEventListener('click', () => openCustomer(Number(card.dataset.customerId)));
    });
  }

  function pageList(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 4) pages.push('gap-start');
    const from = Math.max(2, current - 1);
    const to = Math.min(total - 1, current + 1);
    for (let i = from; i <= to; i += 1) pages.push(i);
    if (current < total - 3) pages.push('gap-end');
    pages.push(total);
    return pages;
  }

  function renderPagination() {
    const result = state.customerResult;
    const container = $('#pagination');
    if (!result || result.total === 0) {
      container.innerHTML = '';
      return;
    }
    const start = (result.page - 1) * result.pageSize + 1;
    const end = Math.min(result.total, result.page * result.pageSize);
    const pages = pageList(result.page, result.pageCount);

    container.innerHTML = `
      <span class="page-info">Showing ${start}–${end} of ${result.total}</span>
      <button class="page-btn" data-page="${result.page - 1}" ${result.page <= 1 ? 'disabled' : ''} aria-label="Previous page">
        <svg class="icon icon--tiny"><use href="#i-chevron-left"/></svg>
      </button>
      ${pages
        .map((page) =>
          typeof page === 'number'
            ? `<button class="page-btn ${page === result.page ? 'is-active' : ''}" data-page="${page}">${page}</button>`
            : '<span class="page-gap">…</span>',
        )
        .join('')}
      <button class="page-btn" data-page="${result.page + 1}" ${result.page >= result.pageCount ? 'disabled' : ''} aria-label="Next page">
        <svg class="icon icon--tiny"><use href="#i-chevron-right"/></svg>
      </button>`;

    $$('.page-btn[data-page]', container).forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        state.customerFilters.page = Number(button.dataset.page);
        loadCustomers();
        $('#customer-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* =========================================================
     Customer drawer
     ========================================================= */
  async function openCustomer(id) {
    const overlay = $('#drawer-overlay');
    const drawer = $('#drawer');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#drawer-body').innerHTML = '<div style="padding:26px"><div class="skeleton" style="height:52px;margin-bottom:14px"></div><div class="skeleton" style="height:120px;margin-bottom:14px"></div><div class="skeleton" style="height:180px"></div></div>';

    try {
      const customer = await api(`/api/customers/${id}`);
      state.openCustomerId = customer.id;
      renderDrawer(customer);
    } catch (error) {
      $('#drawer-body').innerHTML = `<div class="empty-state" style="margin:24px"><strong>Could not load this customer</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  function closeDrawer() {
    $('#drawer').classList.remove('is-open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawer-overlay').hidden = true;
    document.body.style.overflow = '';
    state.openCustomerId = null;
  }

  function renderDrawer(customer) {
    const tone = toneIndex(customer.name);

    const eventsHtml = customer.events
      .map(
        (event) => `<li class="tl-item" data-type="${esc(event.type)}">
          <span class="tl-dot"></span>
          <p class="tl-label">${esc(event.label)}</p>
          <p class="tl-time">${fmtDateTime(event.occurredAt)}</p>
        </li>`,
      )
      .join('');

    const searchSection = customer.keyword
      ? `<section class="drawer-section">
          <h3>Search journey</h3>
          <div class="query-block">
            <p class="q-label"><svg class="icon icon--tiny" style="width:11px;height:11px"><use href="#i-search"/></svg> Googled before enquiring</p>
            <p class="search-big"><span class="quo">“</span>${esc(customer.keyword)}<span class="quo">”</span></p>
            <div class="q-meta">
              ${customer.productName ? `<span class="pill pill--product">${esc(customer.productName)}</span>` : ''}
              ${sourcePill(customer.termSource || customer.source)}
            </div>
            <div class="q-meta">
              <span class="src" style="font-family:var(--font-mono);font-size:10.5px">${esc(customer.landingPage || 'landing page not recorded')}</span>
            </div>
            <p class="query-note">
              ${customer.termClicks ? `${Number(customer.termClicks).toLocaleString('en-IN')} clicks on this term` : 'No click data for this term'}
              ${customer.termPosition ? ` · average rank #${Number(customer.termPosition).toFixed(1)}` : ''}
              ${customer.gclid ? ` · gclid ${esc(String(customer.gclid).slice(0, 14))}…` : ''}
            </p>
          </div>
        </section>`
      : `<section class="drawer-section">
          <h3>Search journey</h3>
          <div class="callout">
            <svg class="icon icon--tiny"><use href="#i-search"/></svg>
            <span>No Google query was captured for this customer. They came in via <strong>${sourceText(customer.source)}</strong>${customer.landingPage ? ` landing on ${esc(customer.landingPage)}` : ''}. Add the query later if your team finds it.</span>
          </div>
        </section>`;

    $('#drawer-body').innerHTML = `
      <div class="drawer-head">
        <span class="avatar avatar--lg avatar--t${tone}">${esc(initials(customer.name))}</span>
        <div style="min-width:0">
          <h2>${esc(customer.name)}</h2>
          <p class="meta-line">
            <span>MJ-${String(customer.id).padStart(4, '0')}</span>
            <span class="dot"></span>
            <span>${esc(customer.city || 'Unknown city')}</span>
            <span class="dot"></span>
            <span>added ${fmtDate(customer.createdAt, true)}</span>
          </p>
        </div>
        <div class="drawer-actions">
          ${stagePill(customer.stage)}
          <button class="icon-btn" data-close-drawer aria-label="Close">
            <svg class="icon"><use href="#i-x"/></svg>
          </button>
        </div>
      </div>

      ${searchSection}

      <section class="drawer-section">
        <h3>Contact</h3>
        <div class="detail-grid">
          <div class="detail">
            <span>Email</span>
            ${customer.email ? `<a href="mailto:${esc(customer.email)}">${esc(customer.email)}</a>` : '<p>—</p>'}
          </div>
          <div class="detail">
            <span>Phone</span>
            ${customer.phone ? `<a href="tel:${esc(String(customer.phone).replace(/\s/g, ''))}">${esc(customer.phone)}</a>` : '<p>—</p>'}
          </div>
          <div class="detail">
            <span>Source</span>
            <p>${sourcePill(customer.source)}</p>
          </div>
          <div class="detail">
            <span>Device</span>
            <p>${esc(customer.device ? customer.device[0].toUpperCase() + customer.device.slice(1) : '—')}</p>
          </div>
        </div>
      </section>

      <section class="drawer-section">
        <h3>Commercials</h3>
        <div class="detail-grid">
          <div class="detail">
            <span>Budget shared</span>
            <p>${customer.budget ? inr(customer.budget) : '—'}</p>
          </div>
          <div class="detail">
            <span>Quote sent</span>
            <p>${customer.quoteValue ? inr(customer.quoteValue) : 'Not yet'}</p>
          </div>
          <div class="detail">
            <span>Interested in</span>
            <p>${esc(customer.productName || '—')}</p>
          </div>
          <div class="detail">
            <span>Owner</span>
            <p>${esc(customer.owner || 'Unassigned')}</p>
          </div>
          ${customer.notes ? `<div class="detail detail--wide"><span>Original note</span><p>${esc(customer.notes)}</p></div>` : ''}
        </div>
      </section>

      <section class="drawer-section">
        <h3>Move stage</h3>
        <div class="stage-move">
          ${Object.entries(STAGE_LABELS)
            .map(
              ([key, label]) => `<button data-stage="${key}" class="${customer.stage === key ? 'is-current' : ''}">${esc(label)}</button>`,
            )
            .join('')}
        </div>
      </section>

      <section class="drawer-section">
        <h3>Activity <span class="spacer" style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted-2)">last touch ${timeAgo(customer.lastActivityAt)}</span></h3>
        <ol class="timeline">${eventsHtml}</ol>
        <form class="note-form" id="note-form" style="margin-top:14px">
          <textarea name="note" placeholder="Log a call, site visit or WhatsApp follow-up…" required></textarea>
          <div class="row"><button class="btn btn--ghost btn--sm" type="submit">Add activity</button></div>
        </form>
      </section>
    `;

    $('[data-close-drawer]').addEventListener('click', closeDrawer);

    $$('.stage-move button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.dataset.stage === customer.stage) return;
        try {
          await api(`/api/customers/${customer.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ stage: button.dataset.stage }),
          });
          toast(`Moved to ${STAGE_LABELS[button.dataset.stage]}`);
          const updated = await api(`/api/customers/${customer.id}`);
          renderDrawer(updated);
          refreshAfterMutation();
        } catch (error) {
          toast(error.message, true);
        }
      });
    });

    $('#note-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const textarea = event.target.querySelector('textarea');
      const label = textarea.value.trim();
      if (!label) return;
      try {
        await api(`/api/customers/${customer.id}/events`, {
          method: 'POST',
          body: JSON.stringify({ type: 'note', label }),
        });
        const updated = await api(`/api/customers/${customer.id}`);
        renderDrawer(updated);
        toast('Activity logged');
        refreshAfterMutation();
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  /* =========================================================
     Add customer modal
     ========================================================= */
  function openModal() {
    $('#modal-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#add-form').reset();
    $('#add-error').hidden = true;
    setTimeout(() => $('#add-form [name="name"]').focus(), 40);
  }

  function closeModal() {
    $('#modal-overlay').hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     Import / export
     ========================================================= */
  async function handleFiles(files) {
    const file = files && files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('That file is larger than 5 MB.', true);
      return;
    }
    if (state.reference.dataMode !== 'real' && !window.confirm('This demo preview is not private. Upload only synthetic test data here. Continue?')) return;
    const text = await file.text();
    await importCsv(text, file.name);
  }

  function historyWindow() {
    const from = $('#history-from').value;
    const to = $('#history-to').value;
    if (!from || !to || from > to) throw new Error('Choose a valid start and end date.');
    return new URLSearchParams({ from, to });
  }

  async function loadHistory() {
    const target = $('#history-summary');
    try {
      const result = await api(`/api/history?${historyWindow()}`);
      const { totals, months } = result;
      target.innerHTML = `<div class="history-totals">
        <span><strong>${compact(totals.impressions)}</strong> impressions</span>
        <span><strong>${compact(totals.clicks)}</strong> clicks</span>
        <span><strong>${totals.customers}</strong> enquiries</span>
        <span><strong>${totals.attributed}</strong> attributed</span>
      </div>${months.length ? `<div class="table-wrap history-scroll"><table class="history-table">
        <thead><tr><th>Month</th><th>Impressions</th><th>Clicks</th><th>Enquiries</th><th>Attributed</th><th>Won</th></tr></thead>
        <tbody>${months.map((m) => `<tr><td>${esc(m.month)}</td><td>${compact(m.impressions)}</td><td>${compact(m.clicks)}</td><td>${m.customers}</td><td>${m.attributed}</td><td>${m.won}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="hint">No records within this window. Upload dated search reports and enquiry CSVs to see the history.</p>'}`;
    } catch (error) {
      target.textContent = error.message;
    }
  }

  async function importReport() {
    const box = $('#report-result');
    box.hidden = false;
    const file = $('#report-file').files[0];
    if (!file) { box.className = 'import-result is-error'; box.textContent = 'Choose a CSV report first.'; return; }
    if (file.size > 5 * 1024 * 1024) { box.className = 'import-result is-error'; box.textContent = 'File must be under 5 MB.'; return; }
    try {
      const params = historyWindow();
      params.set('source', $('#report-source').value);
      box.className = 'import-result is-warn';
      box.textContent = `Importing ${file.name}…`;
      const response = await fetch(`/api/import/search?${params}`, {
        method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: await file.text(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Import failed');
      box.className = `import-result ${payload.skipped ? 'is-warn' : 'is-ok'}`;
      box.innerHTML = `<strong>${payload.imported} dated rows imported or updated · ${payload.terms} queries</strong>
        ${payload.outOfRange ? ` · ${payload.outOfRange} outside window` : ''}
        ${payload.skipped ? ` · ${payload.skipped} invalid/anonymized rows skipped` : ''}
        ${payload.details?.length ? `<ul>${payload.details.map((d) => `<li>Row ${d.row}: ${esc(d.reason)}</li>`).join('')}</ul>` : ''}`;
      $('#report-file').value = '';
      await Promise.all([loadReference(), loadOverview(), loadQueries()]);
      toast(`${payload.imported} search rows imported`);
    } catch (error) {
      box.className = 'import-result is-error';
      box.textContent = error.message;
      toast(error.message, true);
    }
  }

  async function importCsv(csv, name = 'CSV') {
    const resultBox = $('#import-result');
    resultBox.hidden = false;
    resultBox.className = 'import-result is-warn';
    resultBox.textContent = `Importing ${name}…`;

    try {
      const params = state.reference.dataMode === 'real' ? `?${historyWindow()}` : '';
      const response = await fetch(`/api/import${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csv,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Import failed');

      const ok = payload.imported > 0;
      resultBox.className = `import-result ${ok ? (payload.skipped ? 'is-warn' : 'is-ok') : 'is-error'}`;
      resultBox.innerHTML = `
        <strong>${ok ? `Imported ${payload.imported} customer${payload.imported === 1 ? '' : 's'}` : 'Nothing imported'}</strong>
        ${payload.skipped ? ` · ${payload.skipped} row${payload.skipped === 1 ? '' : 's'} skipped` : ''}
        ${payload.details && payload.details.length ? `<ul>${payload.details.map((d) => `<li>Row ${d.row}: ${esc(d.reason)}</li>`).join('')}</ul>` : ''}
      `;
      toast(ok ? `${payload.imported} customers imported` : 'No rows were imported', !ok);
      if (ok) {
        await loadReference();
        await loadOverview();
        if (state.view === 'customers') await loadCustomers();
        if (state.view === 'queries') await loadQueries();
      }
    } catch (error) {
      resultBox.className = 'import-result is-error';
      resultBox.innerHTML = `<strong>Import failed</strong><br>${esc(error.message)}`;
      toast(error.message, true);
    } finally {
      $('#file-input').value = '';
    }
  }

  function customerQueryString() {
    const f = state.customerFilters;
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.productId) params.set('productId', f.productId);
    if (f.source) params.set('source', f.source);
    if (f.city) params.set('city', f.city);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    if (f.stages.length) params.set('stage', f.stages.join(','));
    return params.toString();
  }

  async function resetDemo() {
    if (!window.confirm('DANGER: This permanently deletes ALL customer records, imported reports and notes, including REAL data. Regenerate demo data?')) return;
    try {
      await api('/api/demo/reset', { method: 'POST' });
      state.customerFilters = { ...state.customerFilters, q: '', productId: '', source: '', city: '', from: '', to: '', stages: [], termId: '', page: 1 };
      ['#c-search', '#c-product', '#c-source', '#c-city', '#c-from', '#c-to', '#global-search'].forEach((sel) => { $(sel).value = ''; });
      state.historyDefaultApplied = false;
      await loadReference();
      await loadOverview();
      await loadCustomers();
      await loadQueries();
      renderActiveFilters();
      toast('Demo data regenerated');
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function refreshAfterMutation() {
    await Promise.all([loadReference(), loadOverview()]);
    if (state.view === 'customers') await loadCustomers();
    if (state.view === 'queries') await loadQueries();
  }

  /* =========================================================
     Events
     ========================================================= */
  function bindEvents() {
    // nav
    $$('.nav-item[data-view]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        location.hash = `#/${link.dataset.view}`;
        if (state.view !== link.dataset.view) navigate(link.dataset.view);
      });
    });

    $('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('is-open'));
    document.addEventListener('click', (event) => {
      if (window.innerWidth > 900) return;
      const sidebar = $('#sidebar');
      if (sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && event.target !== $('#menu-btn')) {
        sidebar.classList.remove('is-open');
      }
    });

    // range chips
    $$('#range-chips button').forEach((button) => {
      button.addEventListener('click', async () => {
        $$('#range-chips button').forEach((b) => b.classList.toggle('is-active', b === button));
        state.rangeDays = Number(button.dataset.days);
        await loadOverview();
      });
    });

    // chart metric
    $$('#chart-metric button').forEach((button) => {
      button.addEventListener('click', () => {
        $$('#chart-metric button').forEach((b) => b.classList.toggle('is-active', b === button));
        state.chartMetric = button.dataset.metric;
        renderChart();
      });
    });

    // global search
    const globalSearch = $('#global-search');
    globalSearch.addEventListener(
      'input',
      debounce(() => {
        const value = globalSearch.value.trim();
        state.customerFilters.q = value;
        state.customerFilters.page = 1;
        state.customerFilters.termId = '';
        $('#c-search').value = value;
        if (state.view !== 'customers') {
          location.hash = '#/customers';
          if (state.view !== 'customers') navigate('customers');
        } else {
          loadCustomers();
        }
      }, 300),
    );
    globalSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        state.customerFilters.q = globalSearch.value.trim();
        $('#c-search').value = globalSearch.value.trim();
        location.hash = '#/customers';
        if (state.view !== 'customers') navigate('customers');
        else loadCustomers();
      }
      if (event.key === 'Escape') globalSearch.blur();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement !== globalSearch && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        event.preventDefault();
        globalSearch.focus();
      }
      if (event.key === 'Escape') {
        if (!$('#modal-overlay').hidden) closeModal();
        else if ($('#drawer').classList.contains('is-open')) closeDrawer();
      }
    });

    // customer filters
    $('#c-search').addEventListener(
      'input',
      debounce((event) => {
        state.customerFilters.q = event.target.value.trim();
        state.customerFilters.page = 1;
        globalSearch.value = event.target.value;
        loadCustomers();
      }, 280),
    );
    [['#c-product', 'productId'], ['#c-source', 'source'], ['#c-city', 'city'], ['#c-sort', 'sort']].forEach(
      ([selector, key]) => {
        $(selector).addEventListener('change', (event) => {
          state.customerFilters[key] = event.target.value;
          state.customerFilters.page = 1;
          loadCustomers();
        });
      },
    );

    ['from', 'to'].forEach((key) => {
      $(`#c-${key}`).addEventListener('change', (event) => {
        state.customerFilters[key] = event.target.value;
        state.customerFilters.page = 1;
        loadCustomers();
      });
    });

    // query filters
    $('#q-search').addEventListener(
      'input',
      debounce((event) => {
        state.queryFilters.q = event.target.value.trim();
        loadQueries();
      }, 280),
    );
    [['#q-product', 'productId'], ['#q-source', 'source'], ['#q-sort', 'sort']].forEach(([selector, key]) => {
      $(selector).addEventListener('change', (event) => {
        state.queryFilters[key] = event.target.value;
        loadQueries();
      });
    });

    // drawer
    $('#drawer-overlay').addEventListener('click', closeDrawer);

    // add customer
    $('#c-add').addEventListener('click', openModal);
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-cancel').addEventListener('click', closeModal);
    $('#modal-overlay').addEventListener('click', (event) => {
      if (event.target === $('#modal-overlay')) closeModal();
    });
    $('#add-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form).entries());
      const errorBox = $('#add-error');
      errorBox.hidden = true;
      try {
        const created = await api('/api/customers', { method: 'POST', body: JSON.stringify(data) });
        closeModal();
        toast(`${created.name} added to the customer book`);
        await refreshAfterMutation();
        if (state.view !== 'customers') {
          location.hash = '#/customers';
          if (state.view !== 'customers') navigate('customers');
        }
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
    });

    // export
    $('#overview-export').addEventListener('click', () => {
      window.location.href = '/api/export';
    });
    $('#c-export').addEventListener('click', () => {
      const query = customerQueryString();
      window.location.href = `/api/export${query ? `?${query}` : ''}`;
    });
    $('#export-filtered').addEventListener('click', () => {
      const query = customerQueryString();
      window.location.href = `/api/export${query ? `?${query}` : ''}`;
    });

    // historical imports
    ['#history-from', '#history-to'].forEach((sel) => $(sel).addEventListener('change', loadHistory));
    $('#import-report').addEventListener('click', importReport);
    $('#replace-demo').addEventListener('click', async () => {
      if (!window.confirm('Permanently delete ALL demo enquiries and search totals? Do this only on a private server configured with MOVIEJUKE_ADMIN_PASSWORD.')) return;
      try {
        await api('/api/demo/replace', { method: 'POST', body: JSON.stringify({ confirm: 'REPLACE DEMO DATA' }) });
        await Promise.all([loadReference(), loadOverview(), loadQueries()]);
        if (state.view === 'customers') await loadCustomers();
        toast('Demo removed. Upload your historical exports.');
      } catch (error) { toast(error.message, true); }
    });

    // import
    const dropzone = $('#dropzone');
    const fileInput = $('#file-input');
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', (event) => handleFiles(event.target.files));
    ['dragenter', 'dragover'].forEach((type) => {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-drag');
      });
    });
    ['dragleave', 'drop'].forEach((type) => {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-drag');
      });
    });
    dropzone.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));

    // reset
    $('#reset-demo').addEventListener('click', resetDemo);
    $('#reset-demo-side').addEventListener('click', resetDemo);

    // resize
    window.addEventListener('resize', debounce(() => {
      if (state.view === 'overview') renderChart();
    }, 160));
  }

  /* =========================================================
     Boot
     ========================================================= */
  async function boot() {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
    $('#history-to').value = today;
    $('#history-to').max = today;
    $('#history-from').max = today;
    bindEvents();
    state.view = routeFromHash();
    navigate(state.view);

    try {
      await loadReference();
      await Promise.all([loadOverview(), loadQueries()]);
      if (state.view === 'customers') await loadCustomers();
    } catch (error) {
      toast(error.message, true);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
