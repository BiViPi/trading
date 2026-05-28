/* ═══════════════════════════════════════════════════════════════
   Trading Simulation Dashboard — JavaScript Overhaul (v2.1)
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
      meta: { last_updated: new Date().toISOString(), schema_version: "1.1" },
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

  // Ensure equity curve has starting point
  if (D.equity_curve.length === 0 && D.trades.length > 0) {
    rebuildEquityCurve();
  }

  // ── Constants & State variables ───────────────────────────────
  const STARTING_CAPITAL = D.account?.equity_start ?? 10000;
  let activeChartType = 'equity'; // equity, r_multiple, drawdown
  let activeJournalFilter = 'all'; // all, WIN, LOSS, BE, NO-TRADE
  let mainChartInstance = null;

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
        return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch {
        return iso;
      }
    }
  };

  // Safe DOM setter helper
  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  // ── 1. Update Layout Hierarchies & Render KPIs ─────────────────
  function renderStats() {
    const curEquity = D.account.equity_current ?? STARTING_CAPITAL;
    const pnl = curEquity - STARTING_CAPITAL;
    const pnlPct = STARTING_CAPITAL > 0 ? (pnl / STARTING_CAPITAL) * 100 : 0;
    
    // Header Info
    setText('nav-equity', fmt.usd(curEquity));
    
    // KPI 1: Equity
    setText('kpi-equity', fmt.usd(curEquity));
    
    const wins = D.cumulative_stats.wins ?? 0;
    const losses = D.cumulative_stats.losses ?? 0;
    const be = D.cumulative_stats.breakeven ?? 0;
    const totalTrades = wins + losses + be;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Sync memory stats
    D.cumulative_stats.win_rate_pct = parseFloat(winRate.toFixed(2));
    D.cumulative_stats.total_trades = totalTrades;

    const equitySubEl = $('kpi-equity-sub');
    const equityBadgeEl = $('kpi-equity-badge');
    if (totalTrades === 0) {
      if (equitySubEl) equitySubEl.textContent = 'Starting balance';
      if (equityBadgeEl) {
        equityBadgeEl.textContent = '+$0.00 (0.00%)';
        equityBadgeEl.className = 'kpi-badge neutral';
      }
    } else {
      if (equitySubEl) equitySubEl.textContent = `${pnl >= 0 ? '+' : ''}${fmt.usd(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`;
      if (equityBadgeEl) {
        equityBadgeEl.textContent = pnl >= 0 ? 'PROFIT' : 'LOSS';
        equityBadgeEl.className = `kpi-badge ${pnl >= 0 ? 'positive' : 'negative'}`;
      }
    }

    // KPI 2: Win Rate (Grid breakdown)
    const winrateSubEl = $('kpi-winrate-sub');
    if (winrateSubEl) {
      winrateSubEl.textContent = totalTrades > 0 ? `${totalTrades} Closed Trade${totalTrades > 1 ? 's' : ''}` : 'No closed trades yet';
    }

    setText('kpi-winrate-val', totalTrades > 0 ? `${winRate.toFixed(1)}%` : '0.0%');
    setText('kpi-wins-val', wins);
    setText('kpi-losses-val', losses);
    setText('kpi-be-val', be);

    // Apply grey text color if zero trades
    const winsNumEl = $('kpi-wins-val');
    if (winsNumEl) winsNumEl.className = wins > 0 ? 'kpi-stat-num text-win' : 'kpi-stat-num text-muted';
    const lossNumEl = $('kpi-losses-val');
    if (lossNumEl) lossNumEl.className = losses > 0 ? 'kpi-stat-num text-loss' : 'kpi-stat-num text-muted';
    const beNumEl = $('kpi-be-val');
    if (beNumEl) beNumEl.className = be > 0 ? 'kpi-stat-num text-muted' : 'kpi-stat-num text-muted';

    // KPI 3: Total R
    const totalR = D.cumulative_stats.total_r ?? 0;
    const avgR = totalTrades > 0 ? totalR / totalTrades : 0;
    D.cumulative_stats.avg_r_per_trade = parseFloat(avgR.toFixed(2));

    setText('kpi-totalr', totalTrades > 0 ? `${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R` : '0.00R');
    
    const totalrSubEl = $('kpi-totalr-sub');
    if (totalrSubEl) {
      totalrSubEl.textContent = totalTrades > 0 ? `Avg: ${totalR >= 0 ? '+' : ''}${avgR.toFixed(2)}R / trade` : 'Avg 0.00R / trade';
    }

    const totalrBadgeEl = $('kpi-totalr-badge');
    if (totalrBadgeEl) {
      totalrBadgeEl.textContent = totalTrades > 0 ? `${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R total` : '0.00R total';
      totalrBadgeEl.className = `kpi-badge ${totalTrades === 0 ? 'neutral' : (totalR >= 0 ? 'positive' : 'negative')}`;
    }

    // KPI 4: Max Drawdown
    const maxDrawdown = D.cumulative_stats.max_drawdown_pct ?? 0;
    const ruleAdherence = D.cumulative_stats.rule_adherence_pct ?? 100;
    
    setText('kpi-drawdown', totalTrades > 0 ? fmt.pct(maxDrawdown) : '0.00%');
    
    const drawdownSubEl = $('kpi-drawdown-sub');
    if (drawdownSubEl) {
      drawdownSubEl.textContent = totalTrades > 0 ? 'Peak drawdown recorded' : 'No drawdown recorded';
    }

    const drawdownBadgeEl = $('kpi-drawdown-badge');
    if (drawdownBadgeEl) {
      drawdownBadgeEl.textContent = `Adherence: ${ruleAdherence}%`;
      drawdownBadgeEl.className = `kpi-badge ${totalTrades === 0 ? 'neutral' : (ruleAdherence === 100 ? 'positive' : (ruleAdherence >= 80 ? 'warning' : 'negative'))}`;
    }

    // Sync Bottom stats section (Level 4 right)
    setText('meta-total-sessions', D.cumulative_stats.total_sessions ?? 0);
    setText('meta-trades-count', `${totalTrades} / ${D.cumulative_stats.total_no_trades ?? 0}`);
    
    const metaAdherenceEl = $('meta-adherence');
    if (metaAdherenceEl) {
      metaAdherenceEl.textContent = `${ruleAdherence.toFixed(1)}%`;
      metaAdherenceEl.className = `stat-meta-value mono ${totalTrades === 0 ? '' : (ruleAdherence >= 90 ? 'text-win' : (ruleAdherence >= 70 ? 'text-warning' : 'text-loss'))}`;
    }

    setText('meta-avg-r', totalTrades > 0 ? `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R` : '0.00R');
    setText('meta-max-dd', fmt.pct(maxDrawdown));
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

    // Destroy existing chart
    if (mainChartInstance) {
      mainChartInstance.destroy();
    }

    // Chart styling setup
    const labels = curve.map((p, idx) => p.date === 'Start' ? 'Start' : `${p.date} (#${idx})`);
    
    let datasetLabel = '';
    let datasetData = [];
    let strokeColor = '#3b82f6';
    let fillColor = 'rgba(59, 130, 246, 0.04)';
    let tooltipCallback = null;

    if (activeChartType === 'equity') {
      datasetLabel = 'Equity (USD)';
      datasetData = curve.map(p => p.equity);
      const isProfitable = datasetData[datasetData.length - 1] >= STARTING_CAPITAL;
      strokeColor = isProfitable ? '#10b981' : '#f43f5e';
      fillColor = isProfitable ? 'rgba(16, 185, 129, 0.04)' : 'rgba(244, 63, 94, 0.04)';
      tooltipCallback = (ctx) => ` Balance: ${fmt.usd(ctx.parsed.y)}`;
    } else if (activeChartType === 'r_multiple') {
      datasetLabel = 'Cumulative R';
      datasetData = curve.map(p => p.r_multiple);
      const isPositive = datasetData[datasetData.length - 1] >= 0;
      strokeColor = isPositive ? '#10b981' : '#f43f5e';
      fillColor = isPositive ? 'rgba(16, 185, 129, 0.04)' : 'rgba(244, 63, 94, 0.04)';
      tooltipCallback = (ctx) => ` R-Result: ${fmt.r(ctx.parsed.y)}`;
    } else if (activeChartType === 'drawdown') {
      datasetLabel = 'Drawdown (%)';
      datasetData = curve.map(p => p.drawdown);
      strokeColor = '#f59e0b';
      fillColor = 'rgba(245, 158, 11, 0.04)';
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
          pointBorderColor: '#0d1117',
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
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            titleFont: { family: 'Geist', size: 11, weight: '700' },
            bodyFont: { family: 'Geist Mono', size: 12 },
            cornerRadius: 6,
            padding: 8,
            displayColors: false,
            callbacks: { label: tooltipCallback }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
            ticks: { color: '#8b95a8', font: { family: 'Geist', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
            ticks: {
              color: '#8b95a8',
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
      if (navPill) navPill.className = 'live-status-pill';
      if (navPillLbl) navPillLbl.textContent = 'OFFLINE';
      if (badgeStatus) {
        badgeStatus.textContent = 'Idle';
        badgeStatus.className = 'status-badge';
      }
      if (headerCta) {
        headerCta.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3,1 11,6 3,11"/></svg><span>Start Session</span>`;
        headerCta.onclick = triggerSessionSim;
      }
      if (inactiveBox) inactiveBox.classList.remove('hidden');
      if (activeBox) activeBox.classList.add('hidden');
      return;
    }

    // Active layouts
    if (inactiveBox) inactiveBox.classList.add('hidden');
    if (activeBox) activeBox.classList.remove('hidden');

    // Status mapping & Toggles
    if (s.status === 'scanning') {
      if (navPill) navPill.className = 'live-status-pill live-scanning';
      if (navPillLbl) navPillLbl.textContent = 'SCANNING';
      if (badgeStatus) {
        badgeStatus.textContent = 'Scanning';
        badgeStatus.className = 'status-badge scanning';
      }
      
      setText('active-symbol', s.symbol || 'BTCUSDT');
      setText('active-strategy', 'Scanning market setups...');
      
      const statVal = $('active-status');
      if (statVal) {
        statVal.textContent = 'SCANNING OPPORTUNITIES';
        statVal.className = 'param-val status-color-val text-warning';
      }
      setText('active-direction', '—');
      
      const activeParams = $('active-trade-params');
      if (activeParams) activeParams.classList.add('hidden');

      // Bind Run Agent on Header if not analyzed
      if (headerCta) {
        if (!s.agent_reasoning) {
          headerCta.innerHTML = `<svg class="ai-spark" width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z"/></svg><span>Run Agent</span>`;
          headerCta.onclick = triggerAgentAnalysis;
        } else {
          headerCta.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><span>Close Session</span>`;
          headerCta.onclick = closeActiveSessionSim;
        }
      }

    } else if (s.status === 'in_trade') {
      if (navPill) navPill.className = 'live-status-pill live-active';
      if (navPillLbl) navPillLbl.textContent = 'IN TRADE';
      if (badgeStatus) {
        badgeStatus.textContent = 'Active';
        badgeStatus.className = 'status-badge active-trading';
      }

      setText('active-symbol', s.symbol || 'BTCUSDT');
      
      const strategyName = {
        ema_trend_v1: 'EMA Trend Support (ema_trend_v1)',
        rsi_reversal_v1: 'RSI Extremes (rsi_reversal_v1)',
        breakout_retest_v1: 'S&R Breakout Retest (breakout_retest_v1)'
      }[s.strategy] || s.strategy;

      setText('active-strategy', strategyName || '—');
      
      const statVal = $('active-status');
      if (statVal) {
        statVal.textContent = 'IN POSITION';
        statVal.className = 'param-val status-color-val text-win';
      }
      
      const dirEl = $('active-direction');
      if (dirEl) {
        dirEl.textContent = s.direction || 'LONG';
        dirEl.className = `param-val direction-val mono ${s.direction === 'LONG' ? 'direction-long' : 'direction-short'}`;
      }

      // Show parameter grid
      const activeParams = $('active-trade-params');
      if (activeParams) activeParams.classList.remove('hidden');
      setText('active-entry', fmt.price(s.entry));
      setText('active-sl', fmt.price(s.sl));
      setText('active-tp', fmt.price(s.tp));
      setText('active-rr', s.rr ? `1:${s.rr}` : '—');

      if (headerCta) {
        headerCta.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><span>Close Session</span>`;
        headerCta.onclick = closeActiveSessionSim;
      }
    }

    // AI Reasoning sub-panel
    const aiIdle = $('ai-reasoning-idle');
    const aiLoading = $('ai-reasoning-loading');
    const aiActive = $('ai-reasoning-active');

    if (s.agent_reasoning) {
      if (aiIdle) aiIdle.classList.add('hidden');
      if (aiLoading) aiLoading.classList.add('hidden');
      if (aiActive) aiActive.classList.remove('hidden');

      setText('ai-context', s.agent_reasoning.context || '—');
      setText('ai-setup', s.agent_reasoning.setup || '—');
      
      const riskEl = $('ai-risk');
      if (riskEl) {
        if (s.agent_reasoning.risk) {
          riskEl.textContent = s.agent_reasoning.risk;
          riskEl.classList.remove('hidden');
        } else {
          riskEl.classList.add('hidden');
        }
      }
    } else {
      if (aiIdle) aiIdle.classList.remove('hidden');
      if (aiLoading) aiLoading.classList.add('hidden');
      if (aiActive) aiActive.classList.add('hidden');
    }
  }

  // ── 4. Strategy performance list ──────────────────────────────
  function renderStrategyPerformance() {
    const container = $('strategy-list-container');
    const emptyEl = $('strategies-empty');
    if (!container) return;

    const ss = D.strategy_stats;
    const strategies = [
      { id: 'ema_trend_v1', name: 'EMA Trend Support' },
      { id: 'rsi_reversal_v1', name: 'RSI Extremes' },
      { id: 'breakout_retest_v1', name: 'S&R Breakout Retest' },
      { id: 'no_trade', name: 'No-Trade Discipline' }
    ];

    let hasData = false;
    let maxR = 0.1; // Divider baseline
    strategies.forEach(s => {
      if (s.id === 'no_trade') {
        const totalNoTrades = D.cumulative_stats.total_no_trades ?? 0;
        if (totalNoTrades > 0) hasData = true;
      } else {
        const data = ss[s.id];
        if (data && data.trades > 0) {
          hasData = true;
          if (Math.abs(data.total_r) > maxR) {
            maxR = Math.abs(data.total_r);
          }
        }
      }
    });

    if (!hasData) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    container.innerHTML = strategies.map(s => {
      let tradesCount = 0;
      let rVal = '0.00R';
      let widthPct = 0;
      let isRPositive = true;
      let isDiscipline = s.id === 'no_trade';
      let rClass = 'neutral';

      if (isDiscipline) {
        tradesCount = D.cumulative_stats.total_no_trades ?? 0;
        rVal = '—';
        widthPct = D.cumulative_stats.rule_adherence_pct ?? 100;
        rClass = 'neutral';
      } else {
        const data = ss[s.id] || { trades: 0, wins: 0, losses: 0, total_r: 0 };
        tradesCount = data.trades;
        isRPositive = data.total_r >= 0;
        rVal = `${isRPositive ? '+' : ''}${data.total_r.toFixed(2)}R`;
        rClass = data.trades === 0 ? 'neutral' : (isRPositive ? 'positive' : 'negative');
        const winRate = data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : 0;
        widthPct = maxR > 0 ? Math.min(100, Math.round((Math.abs(data.total_r) / maxR) * 100)) : 0;
      }

      return `
        <div class="strategy-item ${isDiscipline ? 'strategy-item--discipline' : ''}">
          <div class="strategy-info-row">
            <div class="strat-name-block">
              <span class="strat-display-name">${s.name}</span>
              <span class="strat-code-name">${isDiscipline ? 'discipline_v1' : s.id}</span>
            </div>
            <div class="strat-metrics">
              <div class="strat-metric-box">
                <span class="strat-metric-val">${tradesCount}</span>
                <span class="strat-metric-lbl">${isDiscipline ? 'Count' : 'Trades'}</span>
              </div>
              <div class="strat-metric-box">
                <span class="strat-metric-val ${rClass}">${rVal}</span>
                <span class="strat-metric-lbl">${isDiscipline ? 'Result' : 'R-PnL'}</span>
              </div>
            </div>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${isDiscipline ? 'win' : (isRPositive ? 'win' : '')}" style="width: ${tradesCount > 0 || isDiscipline ? widthPct : 0}%"></div>
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
    const tableEl = $('journal-table-el');
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
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (tableEl) tableEl.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (tableEl) tableEl.classList.remove('hidden');

    tbody.innerHTML = filtered.map(t => {
      const resultBadge = {
        WIN: '<span class="badge badge-win">WIN</span>',
        LOSS: '<span class="badge badge-loss">LOSS</span>',
        BREAKEVEN: '<span class="badge badge-be">BE</span>',
        'NO-TRADE': '<span class="badge badge-notrade">NO-TRADE</span>',
        OPEN: '<span class="badge badge-be" style="color:var(--blue-hover);border-color:var(--border-hi)">OPEN</span>'
      }[t.status] || `<span class="badge badge-be">${t.status}</span>`;

      const dirBadge = t.direction === 'LONG' 
        ? '<span class="badge badge-long">LONG</span>' 
        : t.direction === 'SHORT' 
          ? '<span class="badge badge-short">SHORT</span>' 
          : '<span class="badge badge-be">—</span>';

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
          <td>${dirBadge}</td>
          <td style="color:var(--text-secondary); font-size:11px">${t.strategy}</td>
          <td class="text-right mono">${entryPrice}</td>
          <td class="text-right mono text-loss" style="font-size:11px">${slPrice}</td>
          <td class="text-right mono text-win" style="font-size:11px">${tpPrice}</td>
          <td class="text-right mono">${rrRatio}</td>
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
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

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
              <span class="review-mini-val text-win" style="color:${(r.net_r ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'}">
                ${(r.net_r ?? 0) >= 0 ? '+' : ''}${(r.net_r ?? 0).toFixed(2)}R
              </span>
            </div>
            <div class="review-mini-cell">
              <span class="review-mini-label">PnL</span>
              <span class="review-mini-val" style="color:${(r.net_pnl_usd ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'}">
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
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    grid.innerHTML = patterns.map(p => {
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

    D.active_session = {
      status: 'scanning',
      symbol: 'BTCUSDT',
      strategy: null,
      entry: null, sl: null, tp: null, rr: null,
      agent_reasoning: null
    };
    D.cumulative_stats.total_sessions += 1;
    D.meta.last_updated = new Date().toISOString();
    
    renderLiveSession();
    renderStats();

    // Auto-trigger Agent Reasoning after 1.2 seconds of scanning
    setTimeout(() => {
      if (D.active_session && D.active_session.status === 'scanning' && !D.active_session.agent_reasoning) {
        triggerAgentAnalysis();
      }
    }, 1200);
  };

  window.closeActiveSessionSim = function () {
    if (!D.active_session) return;

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
      triggerSessionSim();
      return;
    }

    const aiIdle = $('ai-reasoning-idle');
    const aiLoading = $('ai-reasoning-loading');
    const aiActive = $('ai-reasoning-active');

    if (aiIdle) aiIdle.classList.add('hidden');
    if (aiLoading) aiLoading.classList.remove('hidden');
    if (aiActive) aiActive.classList.add('hidden');

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
            context: 'Solid H4 bullish structure. EMA 21 & EMA 50 stacked and sloping upwards. ADX = 28.4 indicates high trend strength.',
            setup: 'Price retested dynamic support zone of EMA 21. Bullish hammer candle formed on H4 with elevated volume.',
            risk: 'Upcoming US CPI news tonight. Keep leverage conservative and monitor short-term spikes.'
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
            context: 'Price approaching major historical resistance. H1 RSI reached 78.5 (overbought) with clear bearish divergence.',
            setup: 'Bearish engulfing candle formed at the upper bound of the ascending channel. MACD bearish crossover.',
            risk: 'Counter-trend trade. Strict 1% account risk limit must be enforced.'
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
            context: 'Clean breakout of a 5-day symmetrical triangle pattern on the H1 timeframe.',
            setup: 'Pinbar candle retesting the upper boundary of the triangle (new dynamic support). Declining sell volume.',
            risk: 'Failure to close above $68,300 invalidates the breakout setup (Fakeout risk).'
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
    
    // Simulate discipline checks
    const violatesRules = Math.random() < 0.15; // 15% chance of rule violation
    if (violatesRules) {
      D.cumulative_stats.rule_violations += 1;
    }
    
    const isWin = Math.random() > 0.4; // 60% win rate
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

    D.trades.push(newTrade);
    
    // Update stats
    if (result === 'WIN') D.cumulative_stats.wins += 1;
    else if (result === 'LOSS') D.cumulative_stats.losses += 1;
    else D.cumulative_stats.breakeven += 1;

    D.cumulative_stats.total_r = parseFloat((D.cumulative_stats.total_r + r_res).toFixed(2));
    D.cumulative_stats.total_pnl_usd = parseFloat((D.cumulative_stats.total_pnl_usd + pnl).toFixed(2));
    
    // Update strategy metrics
    if (!D.strategy_stats[s.strategy]) {
      D.strategy_stats[s.strategy] = { trades: 0, wins: 0, losses: 0, total_r: 0 };
    }
    const stratMetric = D.strategy_stats[s.strategy];
    stratMetric.trades += 1;
    if (result === 'WIN') stratMetric.wins += 1;
    else if (result === 'LOSS') stratMetric.losses += 1;
    stratMetric.total_r = parseFloat((stratMetric.total_r + r_res).toFixed(2));

    // Calculate Adherence
    const totalCount = D.trades.length;
    D.cumulative_stats.rule_adherence_pct = Math.max(0, Math.round(((totalCount - D.cumulative_stats.rule_violations) / totalCount) * 100));

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
    const modal = $('add-trade-modal');
    if (modal) modal.classList.remove('hidden');
    
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
    const modal = $('add-trade-modal');
    if (modal) modal.classList.add('hidden');
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
        lesson: 'Perfect adherence to the trading plan. Stayed calm when price approached Stop Loss and did not move the SL.',
        permission: 'trade'
      },
      {
        lesson: 'Avoided trading during high volatility leading up to the FOMC news. Good decision to sit on hands.',
        permission: 'trade'
      },
      {
        lesson: 'Discipline error: FOMO entry when price had already run too far from the Entry. Suspended trading for the next session.',
        permission: 'review'
      }
    ];

    const pick = list[Math.floor(Math.random() * list.length)];

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
        description: 'Bullish flag pattern forming after a strong uptrend. Retest and breakout of the upper boundary with high volume confirms trend continuation.',
        status: 'confirmed',
        observed: 4,
        win_rate: 75
      },
      {
        title: 'Double Bottom Support',
        description: 'Double bottom pattern forming at H4 key support. Bullish RSI divergence provides strong reversal signals.',
        status: 'probable',
        observed: 2,
        win_rate: 50
      },
      {
        title: 'Head and Shoulders Peak',
        description: 'Head and shoulders pattern indicating bearish trend reversal at structural highs. Breakdown below neckline triggers technical selloff.',
        status: 'hypothesis',
        observed: 1,
        win_rate: 0
      }
    ];

    const pick = patterns[Math.floor(Math.random() * patterns.length)];
    
    // Check if title already exists, increment observed
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

  // Action: Add Simulated No-Trade discipline log
  window.triggerNoTradeSim = function () {
    const disciplineScenarios = [
      {
        strategy: 'Discipline Check',
        reason: 'Market context highly volatile pre-FOMC. Sticking to plan to stay flat.',
      },
      {
        strategy: 'Setup Invalidated',
        reason: 'EMA Retest did not produce a bullish trigger candle. Sticking to rules.',
      },
      {
        strategy: 'Drawdown Circuit Breaker',
        reason: 'Daily max loss limits reached. Disabling trading session.',
      }
    ];

    const pick = disciplineScenarios[Math.floor(Math.random() * disciplineScenarios.length)];
    
    const newNoTrade = {
      date: new Date().toISOString(),
      strategy: pick.strategy,
      reason: pick.reason
    };

    if (!D.no_trades) D.no_trades = [];
    D.no_trades.push(newNoTrade);

    D.cumulative_stats.total_no_trades = (D.cumulative_stats.total_no_trades ?? 0) + 1;
    D.meta.last_updated = new Date().toISOString();

    renderStats();
    renderStrategyPerformance();
    filterAndRenderTable();
  };

  // ── 8. Initial Initialization on Load ─────────────────────────
  function init() {
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

    // Attach form submit
    const formEl = $('add-trade-form');
    if (formEl) {
      formEl.onsubmit = handleFormSubmit;
    }

    // Set starting states
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
          nav.querySelector('.nav-shell').style.borderRadius = '16px';
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
