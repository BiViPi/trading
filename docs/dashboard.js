/* ═══════════════════════════════════════════════════════════════
   Trading Simulation Dashboard — JavaScript
   Reads from window.TRADING_DATA (injected by data/trading_data.js)
   Renders charts, tables, reviews, patterns
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const D = window.TRADING_DATA;
  if (!D) {
    console.error('[Dashboard] window.TRADING_DATA not found. Check data/trading_data.js');
    return;
  }

  // ── Helpers ──────────────────────────────────────────────────

  const $ = (id) => document.getElementById(id);
  const fmt = {
    usd: (v) => v >= 0
      ? `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `-$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pct: (v) => `${(+v).toFixed(2)}%`,
    r: (v) => `${(+v).toFixed(2)}R`,
    price: (v) => v ? `$${(+v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—',
    date: (iso) => {
      if (!iso) return '—';
      try {
        return new Date(iso).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      } catch { return iso; }
    }
  };

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setClass(id, cls) {
    const el = $(id);
    if (el) el.className = cls;
  }

  // ── Nav: Last updated & price ─────────────────────────────────
  function renderNav() {
    if (D.meta?.last_updated) {
      setText('last-updated', fmt.date(D.meta.last_updated));
    }

    const active = D.active_session;
    if (active?.symbol) setText('nav-symbol', active.symbol);

    // Derive nav equity
    const equity = D.account?.equity_current ?? 10000;
    setText('nav-equity', fmt.usd(equity));
  }

  // ── Hero Stats ────────────────────────────────────────────────
  function renderStats() {
    const a = D.account;
    const s = D.cumulative_stats;

    const equity = a?.equity_current ?? 10000;
    const start = a?.equity_start ?? 10000;
    const pnl = equity - start;
    const pnlPct = ((pnl / start) * 100).toFixed(2);

    // Equity
    setText('stat-equity', fmt.usd(equity));
    const deltaEl = $('stat-equity-delta');
    if (deltaEl) {
      deltaEl.textContent = `${pnl >= 0 ? '+' : ''}${fmt.usd(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPct}%)`;
      deltaEl.className = `stat-delta ${pnl >= 0 ? 'positive' : 'negative'}`;
    }
    setText('nav-equity', fmt.usd(equity));

    // Win rate
    if (s.total_trades > 0) {
      setText('stat-winrate', `${s.win_rate_pct}%`);
      setText('stat-winrate-sub', `${s.total_trades} trades`);
    }

    // R
    setText('stat-total-r', fmt.r(s.total_r ?? 0));
    setText('stat-avg-r', `Avg ${fmt.r(s.avg_r_per_trade ?? 0)} / trade`);

    // Drawdown + adherence
    setText('stat-drawdown', `${(s.max_drawdown_pct ?? 0).toFixed(2)}%`);
    setText('stat-adherence', `Adherence: ${s.rule_adherence_pct ?? 100}%`);
  }

  // ── Equity Curve Chart ────────────────────────────────────────
  function renderEquityChart() {
    const curve = D.equity_curve ?? [];
    const emptyEl = $('equity-empty');
    const canvas = $('equity-chart');
    if (!canvas) return;

    if (curve.length < 2) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';

    const labels = curve.map(p => p.date);
    const values = curve.map(p => p.equity);
    const start = values[0];
    const isPositive = values[values.length - 1] >= start;

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: isPositive ? '#22d3a0' : '#f75555',
          backgroundColor: isPositive
            ? 'rgba(34, 211, 160, 0.08)'
            : 'rgba(247, 85, 85, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: isPositive ? '#22d3a0' : '#f75555',
          pointBorderColor: '#1c2234',
          pointBorderWidth: 2,
          pointHoverRadius: 5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutExpo' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2234',
            borderColor: '#2d2e3e',
            borderWidth: 1,
            titleColor: '#ededf3',
            bodyColor: '#c3c3cc',
            callbacks: {
              label: (ctx) => ` $${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(45, 46, 62, 0.5)' },
            ticks: { color: '#8c8c99', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(45, 46, 62, 0.5)' },
            ticks: {
              color: '#8c8c99',
              font: { size: 11 },
              callback: (v) => `$${v.toLocaleString()}`
            }
          }
        }
      }
    });

    const endEquity = values[values.length - 1];
    setText('equity-chart-meta', `$${start.toLocaleString()} → $${endEquity.toLocaleString()}`);
  }

  // ── Distribution Donut ────────────────────────────────────────
  function renderDistribution() {
    const s = D.cumulative_stats;
    const wins = s.wins ?? 0;
    const losses = s.losses ?? 0;
    const be = s.breakeven ?? 0;
    const total = wins + losses + be;

    setText('dist-wins', wins);
    setText('dist-losses', losses);
    setText('dist-be', be);

    const canvas = $('distribution-chart');
    const center = $('donut-center');
    if (!canvas) return;

    const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
    if (center) {
      center.querySelector('.donut-pct').textContent = winRate !== null ? `${winRate}%` : '—';
    }

    const hasData = total > 0;
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: hasData ? [wins, losses, be] : [1],
          backgroundColor: hasData
            ? ['#22d3a0', '#f75555', '#393947']
            : ['#2d2e3e'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { duration: 800, easing: 'easeOutExpo' },
        plugins: {
          legend: { display: false },
          tooltip: hasData ? {
            backgroundColor: '#1c2234',
            borderColor: '#2d2e3e',
            borderWidth: 1,
            titleColor: '#ededf3',
            bodyColor: '#c3c3cc',
          } : { enabled: false }
        }
      }
    });
  }

  // ── Strategy Bars ─────────────────────────────────────────────
  function renderStrategyBars() {
    const ss = D.strategy_stats;
    const totalTrades = D.cumulative_stats.total_trades || 1;
    const totalSessions = D.cumulative_stats.total_sessions || 1;

    const ema = ss.ema_trend_v1;
    const rsi = ss.rsi_reversal_v1;
    const bo = ss.breakout_retest_v1;
    const nt = ss.no_trade;

    setText('strat-ema-count', `${ema.trades} trade${ema.trades !== 1 ? 's' : ''}`);
    setText('strat-ema-r', `${ema.total_r >= 0 ? '+' : ''}${ema.total_r.toFixed(1)}R`);
    const emaBar = $('strat-ema-bar');
    if (emaBar) emaBar.style.width = `${Math.round((ema.trades / totalTrades) * 100)}%`;

    setText('strat-rsi-count', `${rsi.trades} trade${rsi.trades !== 1 ? 's' : ''}`);
    setText('strat-rsi-r', `${rsi.total_r >= 0 ? '+' : ''}${rsi.total_r.toFixed(1)}R`);
    const rsiBar = $('strat-rsi-bar');
    if (rsiBar) rsiBar.style.width = `${Math.round((rsi.trades / totalTrades) * 100)}%`;

    setText('strat-bo-count', `${bo.trades} trade${bo.trades !== 1 ? 's' : ''}`);
    setText('strat-bo-r', `${bo.total_r >= 0 ? '+' : ''}${bo.total_r.toFixed(1)}R`);
    const boBar = $('strat-bo-bar');
    if (boBar) boBar.style.width = `${Math.round((bo.trades / totalTrades) * 100)}%`;

    setText('strat-nt-count', `${nt.count} session${nt.count !== 1 ? 's' : ''}`);
    const ntBar = $('strat-nt-bar');
    if (ntBar) ntBar.style.width = `${Math.round((nt.count / totalSessions) * 100)}%`;
  }

  // ── Active Session ────────────────────────────────────────────
  function renderActiveSession() {
    const active = D.active_session;
    if (!active) return;

    const statusEl = $('session-status');
    if (statusEl) {
      const dot = statusEl.querySelector('.status-indicator');
      const text = statusEl.querySelector('.status-text');
      if (dot && text) {
        if (active.status === 'analyzing' || active.status === 'in_trade') {
          dot.className = 'status-indicator status-active';
          text.textContent = active.status === 'analyzing' ? 'Đang phân tích...' : 'Đang trong lệnh';
        } else if (active.status === 'closed') {
          dot.className = 'status-indicator status-closed';
          text.textContent = 'Phiên đã kết thúc';
        } else {
          dot.className = 'status-indicator status-idle';
          text.textContent = 'Chờ kích hoạt';
        }
      }
    }

    if (active.symbol) setText('sess-symbol', active.symbol);
    if (active.strategy) setText('sess-strategy', active.strategy);
    if (active.entry) setText('sess-entry', fmt.price(active.entry));
    if (active.sl) setText('sess-sl', fmt.price(active.sl));
    if (active.tp) setText('sess-tp', fmt.price(active.tp));
    if (active.rr) setText('sess-rr', `1:${(+active.rr).toFixed(2)}`);
    if (active.agent_reasoning) setText('reasoning-text', active.agent_reasoning);
  }

  // ── Trade Table ───────────────────────────────────────────────
  const allTrades = [];
  let activeFilter = 'all';

  function renderTradeTable(filter = 'all') {
    activeFilter = filter;
    const tbody = $('trade-tbody');
    if (!tbody) return;

    const trades = D.trades ?? [];
    const noTrades = D.no_trades ?? [];

    // Merge and sort by date desc
    const combined = [
      ...trades.map(t => ({ ...t, _type: 'trade' })),
      ...noTrades.map(t => ({ ...t, _type: 'notrade', status: 'NO-TRADE', direction: '—', strategy: 'NO-TRADE', entry: null, sl: null, tp: null, rr: null, pnl_usd: 0, r_result: 0 }))
    ].sort((a, b) => new Date(b.date || b.timestamp_entry || 0) - new Date(a.date || a.timestamp_entry || 0));

    allTrades.length = 0;
    allTrades.push(...combined);

    const filtered = filter === 'all' ? combined : combined.filter(t => t.status === filter);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="11">
            <div class="table-empty">
              <span class="empty-icon">📋</span>
              <span>${filter === 'all' ? 'Chưa có giao dịch nào.' : `Không có trade với trạng thái "${filter}".`}</span>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(t => {
      const statusBadge = {
        WIN: `<span class="badge badge-win">WIN</span>`,
        LOSS: `<span class="badge badge-loss">LOSS</span>`,
        BREAKEVEN: `<span class="badge badge-be">BE</span>`,
        OPEN: `<span class="badge badge-open">OPEN</span>`,
        'NO-TRADE': `<span class="badge badge-notrade">NO-TRADE</span>`,
      }[t.status] || `<span class="badge badge-be">${t.status}</span>`;

      const dirClass = t.direction === 'LONG' ? 'direction-long' : t.direction === 'SHORT' ? 'direction-short' : '';
      const pnlClass = t.pnl_usd >= 0 ? 'pnl-positive' : 'pnl-negative';
      const rClass = (t.r_result ?? 0) >= 0 ? 'pnl-positive' : 'pnl-negative';

      return `<tr>
        <td class="mono" style="color:var(--text-muted);font-size:12px">${fmt.date(t.date || t.timestamp_entry)}</td>
        <td class="mono" style="font-weight:600">${t.symbol ?? '—'}</td>
        <td><span class="${dirClass}">${t.direction ?? '—'}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${t.strategy ?? '—'}</td>
        <td class="mono">${fmt.price(t.entry)}</td>
        <td class="mono" style="color:var(--color-loss)">${fmt.price(t.sl)}</td>
        <td class="mono" style="color:var(--color-win)">${fmt.price(t.tp)}</td>
        <td class="mono">${t.rr ? `1:${(+t.rr).toFixed(2)}` : '—'}</td>
        <td>${statusBadge}</td>
        <td class="${pnlClass}">${t.pnl_usd !== undefined ? `${t.pnl_usd >= 0 ? '+' : ''}${fmt.usd(t.pnl_usd)}` : '—'}</td>
        <td class="${rClass}">${t.r_result !== undefined ? `${t.r_result >= 0 ? '+' : ''}${(+t.r_result).toFixed(2)}R` : '—'}</td>
      </tr>`;
    }).join('');
  }

  window.filterTrades = function (filter) {
    activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderTradeTable(filter);
  };

  // ── Daily Reviews ─────────────────────────────────────────────
  function renderReviews() {
    const grid = $('reviews-grid');
    if (!grid) return;
    const reviews = D.daily_reviews ?? [];
    if (reviews.length === 0) return;

    grid.innerHTML = reviews.map(r => `
      <div class="review-card card-dark">
        <div class="review-card-header">
          <span class="review-date">${fmt.date(r.date)}</span>
          <span class="review-permission ${r.permission_for_next_day === 'trade' ? 'permission-trade' : 'permission-review'}">
            ${r.permission_for_next_day === 'trade' ? '✓ TRADE TOMORROW' : '⚠ REVIEW ONLY'}
          </span>
        </div>
        <div class="review-stats">
          <div>
            <div class="review-stat-label">TRADES</div>
            <div class="review-stat-val mono">${r.trades_count ?? 0}</div>
          </div>
          <div>
            <div class="review-stat-label">NET R</div>
            <div class="review-stat-val mono" style="color:${(r.net_r ?? 0) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}">
              ${(r.net_r ?? 0) >= 0 ? '+' : ''}${(+(r.net_r ?? 0)).toFixed(2)}R
            </div>
          </div>
          <div>
            <div class="review-stat-label">PNL</div>
            <div class="review-stat-val mono" style="color:${(r.net_pnl_usd ?? 0) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}">
              ${(r.net_pnl_usd ?? 0) >= 0 ? '+' : ''}${fmt.usd(r.net_pnl_usd ?? 0)}
            </div>
          </div>
        </div>
        ${r.lesson_for_next_session ? `<div class="review-lesson">💡 ${r.lesson_for_next_session}</div>` : ''}
      </div>
    `).join('');
  }

  // ── Pattern Library ───────────────────────────────────────────
  function renderPatterns() {
    const grid = $('patterns-grid');
    const countEl = $('pattern-count');
    if (!grid) return;
    const patterns = D.patterns ?? [];
    if (countEl) countEl.textContent = `${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}`;
    if (patterns.length === 0) return;

    grid.innerHTML = patterns.map((p, i) => `
      <div class="pattern-card card-dark">
        <div class="pattern-num">PATTERN #${String(i + 1).padStart(2, '0')}</div>
        <div class="pattern-title">${p.title}</div>
        <span class="pattern-status status-${p.status ?? 'hypothesis'}">${p.status ?? 'hypothesis'}</span>
        <div class="pattern-desc">${p.description}</div>
        ${p.observed ? `<div style="margin-top:12px;font-size:12px;color:var(--text-muted)">
          Observed ${p.observed}× · Win rate ${p.win_rate ?? '—'}%
        </div>` : ''}
      </div>
    `).join('');
  }

  // ── Nav scroll effect ─────────────────────────────────────────
  function initNav() {
    const nav = $('main-nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.style.padding = window.scrollY > 20 ? '8px 0' : '12px 0';
    }, { passive: true });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    renderNav();
    renderStats();
    renderEquityChart();
    renderDistribution();
    renderStrategyBars();
    renderActiveSession();
    renderTradeTable('all');
    renderReviews();
    renderPatterns();
    initNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
