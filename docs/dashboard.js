/* ═══════════════════════════════════════════════════════════════
   Trading Simulation Dashboard — JavaScript Overhaul
   Handles Chart.js rendering, search/filter/sort logic,
   and client-side Interactive Simulation Mode.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Retrieve/Initialize Global State ──────────────────────────
  let D = window.TRADING_DATA;
  if (!D) {
    console.warn('[Dashboard] window.TRADING_DATA not found. Initializing empty fallback.');
    D = {
      meta: { last_updated: new Date().toISOString(), schema_version: "1.0" },
      account: { equity_start: 10000, equity_current: 10000, currency: "USD", mode: "SIMULATED_PAPER_TRADING" },
      cumulative_stats: {
        total_sessions: 0, total_trades: 0, total_no_trades: 0,
        wins: 0, losses: 0, breakeven: 0, win_rate_pct: 0,
        total_r: 0, avg_r_per_trade: 0, total_pnl_usd: 0,
        max_drawdown_pct: 0, rule_violations: 0, rule_adherence_pct: 100
      },
      strategy_stats: {
        ema_trend_v1: { trades: 0, wins: 0, losses: 0, total_r: 0 },
        rsi_reversal_v1: { trades: 0, wins: 0, losses: 0, total_r: 0 },
        breakout_retest_v1: { trades: 0, wins: 0, losses: 0, total_r: 0 },
        no_trade: { count: 0 }
      },
      active_session: null,
      equity_curve: [],
      trades: [],
      no_trades: [],
      daily_reviews: [],
      patterns: []
    };
    window.TRADING_DATA = D;
  }

  // Ensure equity curve has starting point if it has values
  if (D.equity_curve.length === 0 && D.trades.length > 0) {
    rebuildEquityCurve();
  }

  // ── Constants & State variables ───────────────────────────────
  const STARTING_CAPITAL = D.account?.equity_start ?? 10000;
  let activeChartType = 'equity'; // equity, r_multiple, drawdown
  let activeJournalFilter = 'all'; // all, WIN, LOSS, BE, NO-TRADE
  let mainChartInstance = null;
  let simulatedTimerInterval = null;
  let simulatedSecondsElapsed = 0;

  // ── Helper functions ──────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  
  const fmt = {
    usd: (v) => {
      const parsed = parseFloat(v || 0);
      const sign = parsed >= 0 ? '' : '-';
      return `${sign}$${Math.abs(parsed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    pct: (v) => `${parseFloat(v || 0).toFixed(2)}%`,
    r: (v) => `${parseFloat(v || 0).toFixed(2)}R`,
    price: (v) => v ? `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—',
    date: (iso) => {
      if (!iso) return '—';
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch {
        return iso;
      }
    }
  };

  // ── 1. Update Layout Hierarchies & Render KPIs ─────────────────
  function renderStats() {
    const curEquity = D.account.equity_current ?? STARTING_CAPITAL;
    const pnl = curEquity - STARTING_CAPITAL;
    const pnlPct = STARTING_CAPITAL > 0 ? (pnl / STARTING_CAPITAL) * 100 : 0;
    
    // Header Info
    const navEquityEl = $('nav-equity');
    if (navEquityEl) navEquityEl.textContent = fmt.usd(curEquity);
    
    // KPI 1: Equity
    const equityValEl = $('kpi-equity');
    if (equityValEl) equityValEl.textContent = fmt.usd(curEquity);
    
    const equityBadgeEl = $('kpi-equity-badge');
    if (equityBadgeEl) {
      equityBadgeEl.textContent = `${pnl >= 0 ? '+' : ''}${fmt.usd(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`;
      equityBadgeEl.className = `kpi-badge ${pnl >= 0 ? (pnl === 0 ? 'neutral' : 'positive') : 'negative'}`;
    }

    // KPI 2: Win Rate
    const wins = D.cumulative_stats.wins ?? 0;
    const losses = D.cumulative_stats.losses ?? 0;
    const be = D.cumulative_stats.breakeven ?? 0;
    const totalTrades = wins + losses + be;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    
    // Sync memory
    D.cumulative_stats.win_rate_pct = parseFloat(winRate.toFixed(2));
    D.cumulative_stats.total_trades = totalTrades;

    const winRateEl = $('kpi-winrate');
    if (winRateEl) winRateEl.textContent = totalTrades > 0 ? `${winRate.toFixed(1)}%` : '0.0%';
    
    const winrateSubEl = $('kpi-winrate-sub');
    if (winrateSubEl) {
      winrateSubEl.textContent = totalTrades > 0 ? `${totalTrades} Closed Trade${totalTrades > 1 ? 's' : ''}` : 'No closed trades yet';
    }
    
    const winrateBadgeEl = $('kpi-winrate-badge');
    if (winrateBadgeEl) {
      winrateBadgeEl.textContent = `${wins}W / ${losses}L / ${be}BE`;
      winrateBadgeEl.className = `kpi-badge ${winRate >= 50 ? 'positive' : (totalTrades === 0 ? 'neutral' : 'warning')}`;
    }

    // KPI 3: Total R
    const totalR = D.cumulative_stats.total_r ?? 0;
    const avgR = totalTrades > 0 ? totalR / totalTrades : 0;
    D.cumulative_stats.avg_r_per_trade = parseFloat(avgR.toFixed(2));

    const totalrEl = $('kpi-totalr');
    if (totalrEl) totalrEl.textContent = fmt.r(totalR);
    
    const totalrBadgeEl = $('kpi-totalr-badge');
    if (totalrBadgeEl) {
      totalrBadgeEl.textContent = `Avg: ${fmt.r(avgR)} / trade`;
      totalrBadgeEl.className = `kpi-badge ${totalR >= 0 ? (totalR === 0 ? 'neutral' : 'positive') : 'negative'}`;
    }

    // KPI 4: Max Drawdown
    const maxDrawdown = D.cumulative_stats.max_drawdown_pct ?? 0;
    const ruleAdherence = D.cumulative_stats.rule_adherence_pct ?? 100;
    
    const drawdownEl = $('kpi-drawdown');
    if (drawdownEl) drawdownEl.textContent = fmt.pct(maxDrawdown);
    
    const drawdownBadgeEl = $('kpi-drawdown-badge');
    if (drawdownBadgeEl) {
      drawdownBadgeEl.textContent = `Adherence: ${ruleAdherence}%`;
      drawdownBadgeEl.className = `kpi-badge ${ruleAdherence === 100 ? 'positive' : (ruleAdherence >= 80 ? 'warning' : 'negative')}`;
    }

    // Sync Bottom stats section (Level 4 right)
    const metaSessionsEl = $('meta-total-sessions');
    if (metaSessionsEl) metaSessionsEl.textContent = D.cumulative_stats.total_sessions ?? 0;
    
    const metaTradesEl = $('meta-trades-count');
    if (metaTradesEl) metaTradesEl.textContent = `${totalTrades} / ${D.cumulative_stats.total_no_trades ?? 0}`;
    
    const metaAdherenceEl = $('meta-adherence');
    if (metaAdherenceEl) {
      metaAdherenceEl.textContent = `${ruleAdherence.toFixed(1)}%`;
      metaAdherenceEl.className = `stat-meta-value mono ${ruleAdherence >= 90 ? 'text-win' : (ruleAdherence >= 70 ? 'text-warning' : 'text-loss')}`;
    }

    const metaAvgREl = $('meta-avg-r');
    if (metaAvgREl) metaAvgREl.textContent = fmt.r(avgR);
    
    const metaMaxDDEl = $('meta-max-dd');
    if (metaMaxDDEl) metaMaxDDEl.textContent = fmt.pct(maxDrawdown);
    
    setText('last-updated', fmt.date(D.meta.last_updated));
  }

  // ── 2. Performance / Equity Curve Charting ────────────────────
  function rebuildEquityCurve() {
    let current = STARTING_CAPITAL;
    const curve = [{ date: 'Start', equity: current, r_multiple: 0, drawdown: 0 }];
    let peak = current;
    let maxDD = 0;

    // Sort trades chronologically
    const sortedTrades = [...D.trades].sort((a, b) => new Date(a.date || a.timestamp_entry) - new Date(b.date || b.timestamp_entry));
    
    let cumulativeR = 0;
    sortedTrades.forEach(t => {
      current += (t.pnl_usd ?? 0);
      cumulativeR += (t.r_result ?? 0);
      if (current > peak) peak = current;
      const dd = peak > 0 ? ((peak - current) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      
      curve.push({
        date: t.date ? t.date.split('T')[0] : 'Trade',
        equity: current,
        r_multiple: cumulativeR,
        drawdown: dd
      });
    });

    D.equity_curve = curve;
    D.account.equity_current = current;
    D.cumulative_stats.max_drawdown_pct = maxDD;
  }

  function renderPerformanceChart() {
    const curve = D.equity_curve ?? [];
    const canvas = $('equity-chart');
    const emptyEl = $('chart-empty');
    if (!canvas) return;

    if (curve.length < 2) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      canvas.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    canvas.classList.remove('hidden');

    // Destroy existing chart to prevent hover gltiches
    if (mainChartInstance) {
      mainChartInstance.destroy();
    }

    // Chart styling setup
    const labels = curve.map((p, idx) => p.date === 'Start' ? 'Start' : `${p.date} (#${idx})`);
    
    let datasetLabel = '';
    let datasetData = [];
    let strokeColor = '#5F58F6';
    let fillColor = 'rgba(95, 88, 246, 0.05)';
    let tooltipCallback = null;

    if (activeChartType === 'equity') {
      datasetLabel = 'Equity (USD)';
      datasetData = curve.map(p => p.equity);
      const isProfitable = datasetData[datasetData.length - 1] >= STARTING_CAPITAL;
      strokeColor = isProfitable ? '#10b981' : '#ef4444';
      fillColor = isProfitable ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
      tooltipCallback = (ctx) => ` Balance: ${fmt.usd(ctx.parsed.y)}`;
    } else if (activeChartType === 'r_multiple') {
      datasetLabel = 'Cumulative R';
      datasetData = curve.map(p => p.r_multiple);
      const isPositive = datasetData[datasetData.length - 1] >= 0;
      strokeColor = isPositive ? '#10b981' : '#ef4444';
      fillColor = isPositive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
      tooltipCallback = (ctx) => ` R-Result: ${fmt.r(ctx.parsed.y)}`;
    } else if (activeChartType === 'drawdown') {
      datasetLabel = 'Drawdown (%)';
      datasetData = curve.map(p => p.drawdown);
      strokeColor = '#f59e0b';
      fillColor = 'rgba(245, 158, 11, 0.05)';
      tooltipCallback = (ctx) => ` Drawdown: ${fmt.pct(ctx.parsed.y)}`;
    }

    const ctx = canvas.getContext('2d');
    mainChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: datasetData,
          borderColor: strokeColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: strokeColor,
          pointBorderColor: '#0e1220',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: strokeColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 10, bottom: 5, left: 5, right: 15 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d1117',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleFont: { family: 'Geist', size: 11, weight: '700' },
            bodyFont: { family: 'Geist Mono', size: 12 },
            cornerRadius: 8,
            padding: 10,
            displayColors: false,
            callbacks: { label: tooltipCallback }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)', drawTicks: false },
            ticks: { color: '#626a84', font: { family: 'Plus Jakarta Sans', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.03)', drawTicks: false },
            ticks: {
              color: '#626a84',
              font: { family: 'Geist Mono', size: 10 },
              callback: (v) => {
                if (activeChartType === 'equity') return `$${v.toLocaleString()}`;
                if (activeChartType === 'r_multiple') return `${v}R`;
                return `${v}%`;
              }
            }
          }
        }
      }
    });
  }

  window.switchChartType = function (chartType) {
    activeChartType = chartType;
    document.querySelectorAll('.chart-toggle-toolbar .toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-chart-type') === chartType);
    });
    renderPerformanceChart();
  };

  // ── 3. Live Session Controller ────────────────────────────────
  function renderLiveSession() {
    const s = D.active_session;
    const navPill = $('live-indicator-pill');
    const navPillLbl = $('live-status-lbl');
    const headerCta = $('primary-cta');

    const inactiveBox = $('session-inactive-box');
    const activeBox = $('session-active-box');
    const badgeStatus = $('session-badge-status');

    if (!s || s.status === 'offline') {
      // Inactive layout
      navPill.className = 'live-status-pill';
      if (navPillLbl) navPillLbl.textContent = 'OFFLINE';
      if (badgeStatus) {
        badgeStatus.textContent = 'OFFLINE';
        badgeStatus.className = 'status-badge';
      }
      if (headerCta) {
        headerCta.querySelector('span').textContent = 'Start Session';
        headerCta.onclick = triggerSessionSim;
      }
      inactiveBox.classList.remove('hidden');
      activeBox.classList.add('hidden');
      return;
    }

    // Active layouts
    inactiveBox.classList.add('hidden');
    activeBox.classList.remove('hidden');

    if (headerCta) {
      headerCta.querySelector('span').textContent = 'Close Session';
      headerCta.onclick = closeActiveSessionSim;
    }

    // Status mapping
    if (s.status === 'scanning') {
      navPill.className = 'live-status-pill live-scanning';
      if (navPillLbl) navPillLbl.textContent = 'SCANNING';
      if (badgeStatus) {
        badgeStatus.textContent = 'SCANNING';
        badgeStatus.className = 'status-badge scanning';
      }
      
      $('active-symbol').textContent = s.symbol || 'BTCUSDT';
      $('active-strategy').textContent = 'Analyzing Market Context...';
      $('active-status').textContent = 'SCANNING OPPORTUNITIES';
      $('active-status').className = 'param-val status-color-val text-warning';
      $('active-direction').textContent = '—';
      $('active-trade-params').classList.add('hidden');

    } else if (s.status === 'in_trade') {
      navPill.className = 'live-status-pill live-active';
      if (navPillLbl) navPillLbl.textContent = 'IN TRADE';
      if (badgeStatus) {
        badgeStatus.textContent = 'ACTIVE';
        badgeStatus.className = 'status-badge active-trading';
      }

      $('active-symbol').textContent = s.symbol || 'BTCUSDT';
      $('active-strategy').textContent = s.strategy || 'EMA Trend (ema_trend_v1)';
      
      $('active-status').textContent = 'IN POSITION';
      $('active-status').className = 'param-val status-color-val text-win';
      
      const dirEl = $('active-direction');
      dirEl.textContent = s.direction || 'LONG';
      dirEl.className = `param-val direction-val mono ${s.direction === 'LONG' ? 'direction-long' : 'direction-short'}`;

      // Show parameter subgrid
      $('active-trade-params').classList.remove('hidden');
      $('active-entry').textContent = fmt.price(s.entry);
      $('active-sl').textContent = fmt.price(s.sl);
      $('active-tp').textContent = fmt.price(s.tp);
      $('active-rr').textContent = s.rr ? `1:${s.rr}` : '—';
    }

    // AI Reasoning panel sub-render
    const aiIdle = $('ai-reasoning-idle');
    const aiLoading = $('ai-reasoning-loading');
    const aiActive = $('ai-reasoning-active');

    if (s.agent_reasoning) {
      aiIdle.classList.add('hidden');
      aiLoading.classList.add('hidden');
      aiActive.classList.remove('hidden');

      $('ai-context').textContent = s.agent_reasoning.context || '—';
      $('ai-setup').textContent = s.agent_reasoning.setup || '—';
      
      const riskEl = $('ai-risk');
      if (s.agent_reasoning.risk) {
        riskEl.textContent = s.agent_reasoning.risk;
        riskEl.classList.remove('hidden');
      } else {
        riskEl.classList.add('hidden');
      }
    } else {
      aiIdle.classList.remove('hidden');
      aiLoading.classList.add('hidden');
      aiActive.classList.add('hidden');
    }
  }

  // ── 4. Strategy metrics list ──────────────────────────────────
  function renderStrategyPerformance() {
    const container = $('strategy-list-container');
    const emptyEl = $('strategies-empty');
    if (!container) return;

    const ss = D.strategy_stats;
    const strategies = [
      { id: 'ema_trend_v1', name: 'EMA Trend Support' },
      { id: 'rsi_reversal_v1', name: 'RSI Extremes Overbought/Oversold' },
      { id: 'breakout_retest_v1', name: 'Support & Resistance Breakout' }
    ];

    let hasData = false;
    let maxR = 0.1; // Baseline divider to prevent divide by zero
    strategies.forEach(s => {
      const data = ss[s.id];
      if (data && data.trades > 0) {
        hasData = true;
        if (Math.abs(data.total_r) > maxR) {
          maxR = Math.abs(data.total_r);
        }
      }
    });

    if (!hasData) {
      container.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    container.innerHTML = strategies.map(s => {
      const data = ss[s.id] || { trades: 0, wins: 0, losses: 0, total_r: 0 };
      const winRate = data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : 0;
      
      // Calculate relative percentage width for progress bar
      const widthPct = maxR > 0 ? Math.min(100, Math.round((Math.abs(data.total_r) / maxR) * 100)) : 0;
      const isRPositive = data.total_r >= 0;

      return `
        <div class="strategy-item">
          <div class="strategy-info-row">
            <div class="strat-name-block">
              <span class="strat-display-name">${s.name}</span>
              <span class="strat-code-name">${s.id}</span>
            </div>
            <div class="strat-stats-block">
              <span class="strat-trades-count">${data.trades} trade${data.trades !== 1 ? 's' : ''} (${winRate}% win)</span>
              <span class="strat-r-total ${isRPositive ? 'positive' : 'negative'}">${isRPositive ? '+' : ''}${data.total_r.toFixed(2)}R</span>
            </div>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${isRPositive ? 'win' : ''}" style="width: ${data.trades > 0 ? widthPct : 0}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── 5. Journal Table Logic (Search, Filter, Sort) ─────────────
  window.setJournalFilter = function (filter) {
    activeJournalFilter = filter;
    document.querySelectorAll('.filter-group .filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
    });
    filterAndRenderTable();
  };

  window.filterAndRenderTable = function () {
    const tbody = $('journal-tbody');
    const emptyEl = $('table-empty');
    if (!tbody) return;

    const query = ($('journal-search')?.value || '').toLowerCase().trim();
    const sortVal = $('journal-sort')?.value || 'date-desc';

    // Merge normal trades and no_trades
    const merged = [
      ...D.trades.map(t => ({ ...t, _type: 'trade' })),
      ...D.no_trades.map(nt => ({
        ...nt,
        _type: 'notrade',
        status: 'NO-TRADE',
        direction: '—',
        strategy: nt.strategy || 'NO-TRADE',
        entry: null, sl: null, tp: null, rr: null, pnl_usd: 0, r_result: 0
      }))
    ];

    // Filter by status
    let filtered = merged;
    if (activeJournalFilter !== 'all') {
      filtered = filtered.filter(t => t.status === activeJournalFilter);
    }

    // Filter by search query
    if (query.length > 0) {
      filtered = filtered.filter(t => {
        return (t.symbol && t.symbol.toLowerCase().includes(query)) ||
               (t.strategy && t.strategy.toLowerCase().includes(query)) ||
               (t.status && t.status.toLowerCase().includes(query)) ||
               (t.trade_id && t.trade_id.toLowerCase().includes(query));
      });
    }

    // Sort entries
    filtered.sort((a, b) => {
      const dateA = new Date(a.date || a.timestamp_entry || 0);
      const dateB = new Date(b.date || b.timestamp_entry || 0);

      if (sortVal === 'date-desc') return dateB - dateA;
      if (sortVal === 'date-asc') return dateA - dateB;
      if (sortVal === 'pnl-desc') return (b.pnl_usd ?? 0) - (a.pnl_usd ?? 0);
      if (sortVal === 'pnl-asc') return (a.pnl_usd ?? 0) - (b.pnl_usd ?? 0);
      if (sortVal === 'r-desc') return (b.r_result ?? 0) - (a.r_result ?? 0);
      return 0;
    });

    // Render Table Rows
    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    tbody.innerHTML = filtered.map(t => {
      const resultBadge = {
        WIN: '<span class="badge badge-win">WIN</span>',
        LOSS: '<span class="badge badge-loss">LOSS</span>',
        BREAKEVEN: '<span class="badge badge-be">BE</span>',
        'NO-TRADE': '<span class="badge badge-notrade">NO-TRADE</span>',
        OPEN: '<span class="badge badge-be" style="color:var(--accent-hover);border-color:var(--border-active)">OPEN</span>'
      }[t.status] || `<span class="badge badge-be">${t.status}</span>`;

      const dirClass = t.direction === 'LONG' ? 'direction-long' : t.direction === 'SHORT' ? 'direction-short' : '';
      const pnlClass = t.pnl_usd >= 0 ? 'pnl-positive' : 'pnl-negative';
      const rClass = (t.r_result ?? 0) >= 0 ? 'pnl-positive' : 'pnl-negative';

      const entryPrice = t.entry ? fmt.price(t.entry) : '—';
      const slPrice = t.sl ? fmt.price(t.sl) : '—';
      const tpPrice = t.tp ? fmt.price(t.tp) : '—';
      const rrRatio = t.rr ? `1:${parseFloat(t.rr).toFixed(1)}` : '—';
      const pnlUSD = t._type === 'trade' ? fmt.usd(t.pnl_usd) : '—';
      const rVal = t._type === 'trade' ? fmt.r(t.r_result) : '—';

      return `
        <tr>
          <td class="mono" style="color:var(--text-muted); font-size:11px">${fmt.date(t.date || t.timestamp_entry)}</td>
          <td class="mono" style="font-weight:700">${t.symbol ?? '—'}</td>
          <td><span class="${dirClass}">${t.direction}</span></td>
          <td style="color:var(--text-secondary); font-size:11px">${t.strategy}</td>
          <td class="text-right mono">${entryPrice}</td>
          <td class="text-right mono text-loss" style="font-size:11px">${slPrice}</td>
          <td class="text-right mono text-win" style="font-size:11px">${tpPrice}</td>
          <td class="text-center mono">${rrRatio}</td>
          <td class="text-center">${resultBadge}</td>
          <td class="text-right ${pnlClass}">${pnlUSD}</td>
          <td class="text-right ${rClass}">${rVal}</td>
        </tr>
      `;
    }).join('');
  }

  // ── 6. Level 5: Daily Reviews & Learning Render ──────────────
  function renderReviews() {
    const container = $('reviews-container');
    const emptyEl = $('reviews-empty');
    if (!container) return;

    const reviews = D.daily_reviews ?? [];
    if (reviews.length === 0) {
      container.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    container.innerHTML = reviews.map(r => {
      const isAllowed = r.permission_for_next_day === 'trade';
      const statusClass = isAllowed ? 'text-win' : 'text-loss';
      const statusIcon = isAllowed ? '✓' : '⚠';
      const statusText = isAllowed ? 'TRADE PERMITTED' : 'REVIEW & SHUTDOWN';

      return `
        <div class="review-notebook-card ${isAllowed ? '' : 'review-violation'}">
          <div class="review-card-header">
            <span class="review-date-badge">${fmt.date(r.date)}</span>
            <span class="review-status-text ${statusClass}">
              ${statusIcon} ${statusText}
            </span>
          </div>
          <div class="review-stats-mini">
            <div class="review-mini-cell">
              <span class="review-mini-label">Trades</span>
              <span class="review-mini-val">${r.trades_count ?? 0}</span>
            </div>
            <div class="review-mini-cell">
              <span class="review-mini-label">Net R</span>
              <span class="review-mini-val text-win" style="color:${(r.net_r ?? 0) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}">
                ${(r.net_r ?? 0) >= 0 ? '+' : ''}${(r.net_r ?? 0).toFixed(2)}R
              </span>
            </div>
            <div class="review-mini-cell">
              <span class="review-mini-label">PnL</span>
              <span class="review-mini-val" style="color:${(r.net_pnl_usd ?? 0) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}">
                ${(r.net_pnl_usd ?? 0) >= 0 ? '+' : ''}${fmt.usd(r.net_pnl_usd ?? 0)}
              </span>
            </div>
          </div>
          <div class="review-text-content">
            <p><strong>Lessons:</strong> ${r.lesson_for_next_session || 'No specific notes logged.'}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderPatterns() {
    const grid = $('patterns-grid-container');
    const emptyEl = $('patterns-empty');
    if (!grid) return;

    const patterns = D.patterns ?? [];
    if (patterns.length === 0) {
      grid.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    emptyEl.classList.add('hidden');

    grid.innerHTML = patterns.map((p, idx) => {
      const statusClass = {
        hypothesis: 'pat-hypothesis',
        probable: 'pat-probable',
        confirmed: 'pat-confirmed'
      }[p.status || 'hypothesis'];

      return `
        <div class="pattern-library-card">
          <div>
            <div class="pattern-card-header">
              <span class="pattern-title-text">${p.title}</span>
              <span class="pattern-status-badge ${statusClass}">${p.status}</span>
            </div>
            <p class="pattern-card-desc">${p.description}</p>
          </div>
          <div class="pattern-card-meta">
            <span>Observed: ${p.observed ?? 1}×</span>
            <span class="text-win" style="font-weight:700">Win Rate: ${p.win_rate ?? 0}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── 7. Client-Side Interactive Simulation Actions ────────────

  // Action: Start/Stop Session
  window.triggerSessionSim = function () {
    if (D.active_session) {
      closeActiveSessionSim();
      return;
    }

    // Set status to Scanning
    D.active_session = {
      status: 'scanning',
      symbol: 'BTCUSDT',
      strategy: null,
      entry: null, sl: null, tp: null, rr: null,
      agent_reasoning: null
    };
    D.cumulative_stats.total_sessions += 1;
    D.meta.last_updated = new Date().toISOString();
    
    // Animate transition
    renderLiveSession();
    renderStats();

    // Auto-trigger Agent Reasoning after 1.5 seconds of "scanning"
    setTimeout(() => {
      if (D.active_session && D.active_session.status === 'scanning') {
        triggerAgentAnalysis();
      }
    }, 1200);
  };

  window.closeActiveSessionSim = function () {
    if (!D.active_session) return;

    // If active session has a trade, settle it randomly
    if (D.active_session.status === 'in_trade') {
      settleActiveTradeSim();
    } else {
      // Discard scanning session
      D.active_session = null;
      D.meta.last_updated = new Date().toISOString();
      renderLiveSession();
      renderStats();
    }
  };

  // Action: Trigger Agent Analysis (Run Agent)
  window.triggerAgentAnalysis = function () {
    if (!D.active_session) {
      // Start session first if offline
      triggerSessionSim();
      return;
    }

    const aiIdle = $('ai-reasoning-idle');
    const aiLoading = $('ai-reasoning-loading');
    const aiActive = $('ai-reasoning-active');

    aiIdle.classList.add('hidden');
    aiLoading.classList.remove('hidden');
    aiActive.classList.add('hidden');

    // Simulate AI loading delay
    setTimeout(() => {
      if (!D.active_session) return;

      const randomSetup = [
        {
          strategy: 'ema_trend_v1',
          direction: 'LONG',
          entry: 68500,
          sl: 67800,
          tp: 70600,
          rr: 3.0,
          reasoning: {
            context: 'Xu hướng tăng H4 bền vững. Đường EMA 21 & EMA 50 xếp chồng song song hướng lên trên. Chỉ số ADX = 28.4 biểu thị xu hướng mạnh mẽ.',
            setup: 'Giá hồi quy kỹ thuật (retest) thành công về dải hỗ trợ động EMA 21. Xuất hiện nến rút chân Bullish Hammer ở H4 kèm vol mua đột biến.',
            risk: 'Cần chú ý tin tức CPI Mỹ được công bố tối nay. Tránh giao dịch đòn bẩy quá cao.'
          }
        },
        {
          strategy: 'rsi_reversal_v1',
          direction: 'SHORT',
          entry: 69200,
          sl: 69700,
          tp: 67700,
          rr: 3.0,
          reasoning: {
            context: 'Giá tiệm cận vùng kháng cự cứng ATH chu kỳ trước. RSI khung H1 đạt cực đại 78.5 (Overbought) kết hợp phân kỳ âm rõ rệt.',
            setup: 'Nến đảo chiều Bearish Engulfing xuất hiện ở biên trên kênh giá song song. MACD giao cắt hướng xuống.',
            risk: 'Đi ngược xu hướng chính H4. Tuyệt đối tuân thủ dừng lỗ 1% tài khoản.'
          }
        },
        {
          strategy: 'breakout_retest_v1',
          direction: 'LONG',
          entry: 68950,
          sl: 68300,
          tp: 70900,
          rr: 3.0,
          reasoning: {
            context: 'Giá phá vỡ thành công mô hình tam giác tích lũy (Symmetrical Triangle) kéo dài 5 ngày trên khung đồ thị H1.',
            setup: 'Đang hình thành nến Pinbar retest lại cạnh trên của tam giác đã phá vỡ (vùng hỗ trợ mới). Vol bán giảm dần.',
            risk: 'Nếu đóng nến dưới 68,300 USD thì setup breakout này bị thất bại (Fakeout).'
          }
        }
      ][Math.floor(Math.random() * 3)];

      // Mutate state to in_trade
      D.active_session.status = 'in_trade';
      D.active_session.strategy = randomSetup.strategy;
      D.active_session.direction = randomSetup.direction;
      D.active_session.entry = randomSetup.entry;
      D.active_session.sl = randomSetup.sl;
      D.active_session.tp = randomSetup.tp;
      D.active_session.rr = randomSetup.rr;
      D.active_session.agent_reasoning = randomSetup.reasoning;

      D.meta.last_updated = new Date().toISOString();
      
      renderLiveSession();
      renderStats();
    }, 1000);
  };

  // Helper: Settle Active simulated Trade with a random win/loss
  function settleActiveTradeSim() {
    if (!D.active_session || D.active_session.status !== 'in_trade') return;

    const s = D.active_session;
    const isWin = Math.random() > 0.4; // 60% win rate for simulation fun!
    
    let result = 'LOSS';
    let pnl = -100; // $100 loss (1% risk on $10k capital)
    let r_res = -1.0;

    if (isWin) {
      result = 'WIN';
      r_res = parseFloat(s.rr || 3.0);
      pnl = 100 * r_res; // $300 profit on 3R
    } else if (Math.random() < 0.1) {
      result = 'BREAKEVEN';
      pnl = 0;
      r_res = 0;
    }

    const newTrade = {
      trade_id: `SIM-${String(D.trades.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString(),
      symbol: s.symbol,
      direction: s.direction,
      strategy: s.strategy,
      entry: s.entry,
      sl: s.sl,
      tp: s.tp,
      rr: s.rr,
      status: result,
      pnl_usd: pnl,
      r_result: r_res
    };

    // Update arrays
    D.trades.push(newTrade);
    
    // Settle stats
    if (result === 'WIN') D.cumulative_stats.wins += 1;
    else if (result === 'LOSS') D.cumulative_stats.losses += 1;
    else D.cumulative_stats.breakeven += 1;

    D.cumulative_stats.total_r = parseFloat((D.cumulative_stats.total_r + r_res).toFixed(2));
    D.cumulative_stats.total_pnl_usd = parseFloat((D.cumulative_stats.total_pnl_usd + pnl).toFixed(2));
    
    // Settle strategy metrics
    if (!D.strategy_stats[s.strategy]) {
      D.strategy_stats[s.strategy] = { trades: 0, wins: 0, losses: 0, total_r: 0 };
    }
    const stratMetric = D.strategy_stats[s.strategy];
    stratMetric.trades += 1;
    if (result === 'WIN') stratMetric.wins += 1;
    else if (result === 'LOSS') stratMetric.losses += 1;
    stratMetric.total_r = parseFloat((stratMetric.total_r + r_res).toFixed(2));

    // Reset active session
    D.active_session = null;
    D.meta.last_updated = new Date().toISOString();

    // Redraw
    rebuildEquityCurve();
    renderStats();
    renderPerformanceChart();
    renderLiveSession();
    renderStrategyPerformance();
    filterAndRenderTable();
  }

  // Action: Add Simulated Trade (Form Submit)
  window.openAddTradeModal = function () {
    $('add-trade-modal').classList.remove('hidden');
    // Pre-populate values for convenience
    const entry = 68500;
    const direction = $('trade-direction').value;
    
    $('trade-entry').value = entry;
    if (direction === 'LONG') {
      $('trade-sl').value = entry - 700;
      $('trade-tp').value = entry + 2100;
    } else {
      $('trade-sl').value = entry + 700;
      $('trade-tp').value = entry - 2100;
    }
    toggleFormPnlInputs();
  };

  window.closeAddTradeModal = function () {
    $('add-trade-modal').classList.add('hidden');
  };

  window.toggleFormPnlInputs = function () {
    const result = $('trade-result').value;
    const entry = parseFloat($('trade-entry').value || 0);
    const sl = parseFloat($('trade-sl').value || 0);
    const tp = parseFloat($('trade-tp').value || 0);
    
    let r = 3.0;
    if (entry && sl && entry !== sl) {
      r = Math.abs((tp - entry) / (entry - sl));
    }
    
    if (result === 'WIN') {
      $('trade-rresult').value = r.toFixed(2);
      $('trade-pnl').value = (100 * r).toFixed(2);
    } else if (result === 'LOSS') {
      $('trade-rresult').value = "-1.00";
      $('trade-pnl').value = "-100.00";
    } else {
      $('trade-rresult').value = "0.00";
      $('trade-pnl').value = "0.00";
    }
  };

  window.handleFormSubmit = function (e) {
    e.preventDefault();
    
    const symbol = $('trade-symbol').value.toUpperCase();
    const direction = $('trade-direction').value;
    const strategy = $('trade-strategy').value;
    const result = $('trade-result').value;
    const entry = parseFloat($('trade-entry').value);
    const sl = parseFloat($('trade-sl').value);
    const tp = parseFloat($('trade-tp').value);
    const pnl = parseFloat($('trade-pnl').value);
    const rresult = parseFloat($('trade-rresult').value);

    // Create trade
    const newTrade = {
      trade_id: `SIM-${String(D.trades.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString(),
      symbol, direction, strategy, entry, sl, tp,
      rr: Math.abs((tp - entry) / (entry - sl)).toFixed(2),
      status: result,
      pnl_usd: pnl,
      r_result: rresult
    };

    // Push and calculate
    D.trades.push(newTrade);

    if (result === 'WIN') D.cumulative_stats.wins += 1;
    else if (result === 'LOSS') D.cumulative_stats.losses += 1;
    else D.cumulative_stats.breakeven += 1;

    D.cumulative_stats.total_r = parseFloat((D.cumulative_stats.total_r + rresult).toFixed(2));
    D.cumulative_stats.total_pnl_usd = parseFloat((D.cumulative_stats.total_pnl_usd + pnl).toFixed(2));

    // Strategy metrics update
    if (!D.strategy_stats[strategy]) {
      D.strategy_stats[strategy] = { trades: 0, wins: 0, losses: 0, total_r: 0 };
    }
    const strat = D.strategy_stats[strategy];
    strat.trades += 1;
    if (result === 'WIN') strat.wins += 1;
    else if (result === 'LOSS') strat.losses += 1;
    strat.total_r = parseFloat((strat.total_r + rresult).toFixed(2));

    D.meta.last_updated = new Date().toISOString();

    rebuildEquityCurve();
    renderStats();
    renderPerformanceChart();
    renderStrategyPerformance();
    filterAndRenderTable();
    closeAddTradeModal();
  };

  // Action: Add Simulated Review
  window.triggerReviewSim = function () {
    const list = [
      {
        lesson: 'Tuân thủ kế hoạch giao dịch hoàn hảo. Giữ bình tĩnh khi giá tiệm cận Stop Loss và kiên quyết không dịch SL.',
        permission: 'trade'
      },
      {
        lesson: 'Tránh vào lệnh khi thị trường biến động giật mạnh trước tin tức FOMC. Nên đứng ngoài quan sát.',
        permission: 'trade'
      },
      {
        lesson: 'Lỗi kỷ luật: Fomo vào lệnh khi giá đã chạy quá xa điểm Entry. Phạt ngưng giao dịch 1 phiên kế tiếp.',
        permission: 'review'
      }
    ];

    const pick = list[Math.floor(Math.random() * list.length)];
    const wins = D.cumulative_stats.wins;
    const losses = D.cumulative_stats.losses;

    const newReview = {
      date: new Date().toISOString(),
      trades_count: Math.floor(Math.random() * 3) + 1,
      net_r: (Math.random() * 6) - 2,
      net_pnl_usd: (Math.random() * 600) - 200,
      permission_for_next_day: pick.permission,
      lesson_for_next_session: pick.lesson
    };

    D.daily_reviews.unshift(newReview);
    D.meta.last_updated = new Date().toISOString();
    
    renderReviews();
    renderStats();
  };

  // Action: Add Simulated Pattern
  window.triggerPatternSim = function () {
    const patterns = [
      {
        title: 'Bullish Flag Breakout',
        description: 'Mô hình cờ tăng xuất hiện sau một xu hướng tăng mạnh. Phá vỡ cạnh trên cờ kèm theo khối lượng giao dịch đột biến xác nhận tiếp diễn xu hướng.',
        status: 'confirmed',
        observed: 4,
        win_rate: 75
      },
      {
        title: 'Double Bottom Support',
        description: 'Mô hình 2 đáy hình thành tại vùng hỗ trợ cứng khung H4. RSI phân kỳ dương tạo tín hiệu mua đảo chiều mạnh mẽ.',
        status: 'probable',
        observed: 2,
        win_rate: 50
      },
      {
        title: 'Head and Shoulders Peak',
        description: 'Mô hình Vai Đầu Vai đảo chiều giảm giá tại đỉnh. Phá vỡ đường viền cổ (Neckline) kích hoạt lực bán tháo kỹ thuật.',
        status: 'hypothesis',
        observed: 1,
        win_rate: 0
      }
    ];

    const pick = patterns[Math.floor(Math.random() * patterns.length)];
    
    // Check if title already exists in pattern library, increment observed
    const existing = D.patterns.find(p => p.title === pick.title);
    if (existing) {
      existing.observed += 1;
    } else {
      D.patterns.push({
        title: pick.title,
        description: pick.description,
        status: pick.status,
        observed: pick.observed,
        win_rate: pick.win_rate
      });
    }

    D.meta.last_updated = new Date().toISOString();
    renderPatterns();
  };

  // ── 8. Initial Initialization on Load ─────────────────────────
  function init() {
    // Attach listener to update SL/TP values based on result inside form
    const directionEl = $('trade-direction');
    if (directionEl) directionEl.onchange = toggleFormPnlInputs;
    
    const resultEl = $('trade-result');
    if (resultEl) resultEl.onchange = toggleFormPnlInputs;

    const entryInput = $('trade-entry');
    if (entryInput) entryInput.oninput = toggleFormPnlInputs;
    
    const slInput = $('trade-sl');
    if (slInput) slInput.oninput = toggleFormPnlInputs;
    
    const tpInput = $('trade-tp');
    if (tpInput) tpInput.oninput = toggleFormPnlInputs;

    // Settle starting charts and tables
    rebuildEquityCurve();
    renderStats();
    renderPerformanceChart();
    renderLiveSession();
    renderStrategyPerformance();
    filterAndRenderTable();
    renderReviews();
    renderPatterns();

    // Scroll Navbar transparency effect
    const nav = $('main-nav');
    if (nav) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
          nav.style.top = '0px';
          nav.querySelector('.nav-shell').style.borderRadius = '0';
        } else {
          nav.style.top = '14px';
          nav.querySelector('.nav-shell').style.borderRadius = '18px';
        }
      }, { passive: true });
    }

    // Dynamic price ticker simulation
    setInterval(() => {
      const priceEl = $('nav-price');
      if (priceEl && D.active_session && D.active_session.status !== 'offline') {
        const base = 68500;
        const rand = base + (Math.random() * 400 - 200);
        priceEl.textContent = `$${rand.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
