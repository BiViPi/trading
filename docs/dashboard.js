/* ═══════════════════════════════════════════════════════════════
   Trading Simulation Dashboard — JavaScript Overhaul (v2.2)
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
      meta: { last_updated: new Date().toISOString(), schema_version: "1.2" },
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

  // ── i18n Translation Dictionary ────────────────────────────────
  const TRANSLATIONS = {
    en: {
      // Nav
      nav_title: "Trading Sim",
      offline: "OFFLINE",
      scanning: "SCANNING",
      in_trade: "IN TRADE",
      start_session: "Start Session",
      run_agent: "Run Agent",
      close_session: "Close Session",
      idle: "Idle",
      active: "Active",

      // KPI Cards
      equity: "EQUITY",
      starting_balance: "Starting balance",
      net_profit: "net profit",
      net_loss: "net loss",
      initial: "INITIAL",
      profit_badge: "PROFIT",
      loss_badge: "LOSS",

      win_rate: "WIN RATE",
      no_trades_yet: "No closed trades yet",
      closed_trade: "Closed Trade",
      closed_trades: "Closed Trades",
      wins_lbl: "Wins",
      losses_lbl: "Losses",
      be_lbl: "BE",

      total_r: "TOTAL R",
      avg_r_trade: "Avg: {r} / trade",
      total_r_badge: "{r} total",

      max_drawdown: "MAX DRAWDOWN",
      no_dd_recorded: "No drawdown recorded",
      peak_dd_recorded: "Peak drawdown recorded",
      adherence: "Adherence",

      // Performance Curve
      perf_curve: "PERFORMANCE CURVE",
      perf_chart_title: "Performance Chart",
      no_equity_data: "No equity data yet",
      perf_empty_desc: "Start a session or add your first trade to generate the equity curve.",
      add_trade: "Add Trade",

      // Live Monitor
      live_monitor: "LIVE MONITOR",
      live_session: "Live Session",
      no_active_session: "No active session",
      live_empty_desc: "Start a paper session to let the agent scan setups and track trade levels.",
      strategy: "Strategy",
      status: "Status",
      direction: "Direction",
      scanning_opportunities: "SCANNING OPPORTUNITIES",
      in_position: "IN POSITION",
      scanning_setups: "Scanning setups...",
      market_context_lbl: "Market Context",
      setup_quality_lbl: "Setup Quality",
      risk_notes_lbl: "Risk Notes",

      // Journal Log
      journal_log: "JOURNAL LOG",
      trade_journal: "Trade Journal",
      search_placeholder: "Search symbol, strategy...",
      all: "All",
      wins_filter: "Wins",
      losses_filter: "Losses",
      be_filter: "BE",
      no_trade_filter: "No-Trade",
      sort_newest: "Newest",
      sort_oldest: "Oldest",
      sort_highest_pnl: "Highest PnL",
      sort_lowest_pnl: "Lowest PnL",
      sort_highest_r: "Highest R",
      table_date: "Date",
      table_symbol: "Symbol",
      table_dir: "Dir",
      table_strategy: "Strategy",
      table_entry: "Entry",
      table_sl: "SL",
      table_tp: "TP",
      table_rr: "R:R",
      table_result: "Result",
      table_pnl: "PnL",
      table_r: "R",
      no_trades_logged_yet: "No trades logged yet",
      journal_empty_desc: "Completed sessions and manual trades will appear here.",

      // Metrics
      metrics: "METRICS",
      strat_discipline: "Strategies & Discipline",
      strat_perf_title: "Strategy Performance",
      no_strat_metrics: "No strategy metrics recorded yet.",
      discipline_risk_title: "Discipline & Risk Metrics",
      risk_rule_active: "Risk Rule: Active",
      sessions_completed: "Sessions Completed",
      trades_notrades: "Total Trades / No-Trades",
      discipline_adherence: "Discipline Adherence",
      avg_r_per_trade: "Average R per Trade",
      max_drawdown_stat: "Max Drawdown",

      // Reviews
      reviews: "REVIEWS",
      daily_reviews: "Daily Reviews",
      new_review: "+ Start Review",
      no_reviews_title: "No reviews yet",
      reviews_empty_desc: "Complete a session to generate your first daily review. Agent will checklist:",
      chk_followed_plan: "Followed plan?",
      chk_managed_risk: "Managed risk? (Max 1% capital per trade)",
      chk_lessons_learned: "Lessons learned and patterns noted?",
      trade_permitted: "TRADE PERMITTED",
      review_shutdown: "REVIEW & SHUTDOWN",
      start_review_btn: "Start Review",

      // Learnings / Patterns
      learnings: "LEARNINGS",
      pattern_library: "Pattern Library",
      add_pattern: "+ Add Pattern",
      no_patterns_title: "No patterns saved yet",
      patterns_empty_desc: "Patterns will be created from repeated setups and weekly reviews.",
      ghost_observed: "Ghost pattern",
      observed_lbl: "Observed",
      win_rate_lbl: "Win Rate",
      add_pattern_btn: "Add Pattern",
      ghost_breakout_title: "Breakout Model",
      ghost_breakout_desc: "Horizontal range breakout accompanied by elevated confirmation volume...",
      ghost_pullback_title: "Pullback Retest",
      ghost_pullback_desc: "Entry at key prior resistance flipped support level after breakout...",
      ghost_observed_meta: "Ghost pattern · 0 trades",

      // Footer
      footer_name: "Trading Simulation Dashboard",
      footer_mode: "SIMULATED PAPER TRADING ONLY",
      last_sync: "Last sync",
      capital: "Capital",
      not_advice: "Not financial advice",

      // Modal
      modal_title: "Log Simulated Trade",
      cancel: "Cancel",
      add_trade_btn: "Add Trade",
      entry_price: "Entry Price",
      stop_loss: "Stop Loss",
      take_profit: "Take Profit",
      pnl_usd: "PnL (USD)",
      r_result: "R-Result"
    },
    vi: {
      // Nav
      nav_title: "Mô phỏng giao dịch",
      offline: "NGOẠI TUYẾN",
      scanning: "ĐANG QUÉT",
      in_trade: "ĐANG GIAO DỊCH",
      start_session: "Bắt đầu phiên",
      run_agent: "Chạy Agent",
      close_session: "Đóng phiên",
      idle: "Ngoại tuyến",
      active: "Hoạt động",

      // KPI Cards
      equity: "VỐN TÀI KHOẢN",
      starting_balance: "Số dư ban đầu",
      net_profit: "lợi nhuận ròng",
      net_loss: "thua lỗ ròng",
      initial: "BAN ĐẦU",
      profit_badge: "LỢI NHUẬN",
      loss_badge: "THUA LỖ",

      win_rate: "TỶ LỆ THẮNG",
      no_trades_yet: "Chưa có giao dịch",
      closed_trade: "Lệnh đóng",
      closed_trades: "Lệnh đóng",
      wins_lbl: "Thắng",
      losses_lbl: "Thua",
      be_lbl: "Hòa",

      total_r: "TỔNG R",
      avg_r_trade: "Tb: {r} / lệnh",
      total_r_badge: "Tổng {r}",

      max_drawdown: "DRAWDOWN TỐI ĐA",
      no_dd_recorded: "Chưa có sụt giảm",
      peak_dd_recorded: "Mức sụt giảm tối đa",
      adherence: "Tuân thủ",

      // Performance Curve
      perf_curve: "ĐƯỜNG HIỆU SUẤT",
      perf_chart_title: "Biểu đồ hiệu suất",
      no_equity_data: "Chưa có dữ liệu hiệu suất",
      perf_empty_desc: "Bắt đầu phiên hoặc thêm giao dịch đầu tiên để tạo đường hiệu suất.",
      add_trade: "Thêm giao dịch",

      // Live Monitor
      live_monitor: "THEO DÕI PHIÊN",
      live_session: "Phiên giao dịch",
      no_active_session: "Chưa có phiên đang chạy",
      live_empty_desc: "Khởi chạy một phiên paper trading để agent quét setup và theo dõi các mức giá.",
      strategy: "Chiến lược",
      status: "Trạng thái",
      direction: "Xu hướng",
      scanning_opportunities: "ĐANG TÌM KIẾM CƠ HỘI",
      in_position: "ĐANG CÓ VỊ THẾ",
      scanning_setups: "Đang quét các thiết lập...",
      market_context_lbl: "Bối cảnh thị trường",
      setup_quality_lbl: "Chất lượng thiết lập",
      risk_notes_lbl: "Lưu ý rủi ro",

      // Journal Log
      journal_log: "NHẬT KÝ GIAO DỊCH",
      trade_journal: "Nhật ký giao dịch",
      search_placeholder: "Tìm symbol, chiến lược...",
      all: "Tất cả",
      wins_filter: "Thắng",
      losses_filter: "Thua",
      be_filter: "Hòa",
      no_trade_filter: "Kỷ luật",
      sort_newest: "Mới nhất",
      sort_oldest: "Cũ nhất",
      sort_highest_pnl: "PnL cao nhất",
      sort_lowest_pnl: "PnL thấp nhất",
      sort_highest_r: "R cao nhất",
      table_date: "Ngày",
      table_symbol: "Symbol",
      table_dir: "Dir",
      table_strategy: "Chiến lược",
      table_entry: "Entry",
      table_sl: "SL",
      table_tp: "TP",
      table_rr: "R:R",
      table_result: "Kết quả",
      table_pnl: "PnL",
      table_r: "R",
      no_trades_logged_yet: "Chưa có giao dịch nào",
      journal_empty_desc: "Các phiên đã đóng và giao dịch thủ công sẽ xuất hiện tại đây.",

      // Metrics
      metrics: "CHỈ SỐ",
      strat_discipline: "Chiến lược & Kỷ luật",
      strat_perf_title: "Hiệu suất chiến lược",
      no_strat_metrics: "Chưa có dữ liệu hiệu suất chiến lược.",
      discipline_risk_title: "Chỉ số kỷ luật & rủi ro",
      risk_rule_active: "Luật rủi ro: Kích hoạt",
      sessions_completed: "Số phiên hoàn thành",
      trades_notrades: "Tổng số Lệnh / Kỷ luật",
      discipline_adherence: "Tuân thủ kỷ luật",
      avg_r_per_trade: "R trung bình mỗi lệnh",
      max_drawdown_stat: "Sụt giảm tối đa",

      // Reviews
      reviews: "ĐÁNH GIÁ",
      daily_reviews: "Đánh giá hằng ngày",
      new_review: "+ Viết đánh giá",
      no_reviews_title: "Chưa có đánh giá nào",
      reviews_empty_desc: "Hoàn thành một phiên giao dịch để tạo đánh giá hằng ngày đầu tiên. Agent sẽ kiểm tra:",
      chk_followed_plan: "Có tuân thủ kế hoạch không?",
      chk_managed_risk: "Có quản lý rủi ro không? (Tối đa 1% vốn mỗi lệnh)",
      chk_lessons_learned: "Có ghi nhận bài học và mô hình lặp lại không?",
      trade_permitted: "CHO PHÉP GIAO DỊCH",
      review_shutdown: "KIỂM TRA & ĐÓNG PHIÊN",
      start_review_btn: "Bắt đầu đánh giá",

      // Learnings / Patterns
      learnings: "HỌC TẬP",
      pattern_library: "Thư viện mô hình",
      add_pattern: "+ Thêm mô hình",
      no_patterns_title: "Chưa có mô hình nào được lưu",
      patterns_empty_desc: "Các mô hình sẽ được tạo từ những setup lặp lại và đánh giá hằng tuần.",
      ghost_observed: "Mẫu tham khảo",
      observed_lbl: "Đã quan sát",
      win_rate_lbl: "Tỷ lệ thắng",
      add_pattern_btn: "Thêm mô hình",
      ghost_breakout_title: "Mô hình Breakout",
      ghost_breakout_desc: "Giá phá vỡ tích lũy đi ngang kèm khối lượng giao dịch đột biến xác nhận...",
      ghost_pullback_title: "Pullback Retest",
      ghost_pullback_desc: "Vùng kháng cự cũ chuyển vai trò thành hỗ trợ mới sau cú breakout...",
      ghost_observed_meta: "Mẫu tham khảo · 0 lệnh",

      // Footer
      footer_name: "Bảng mô phỏng giao dịch",
      footer_mode: "CHỈ LÀ MÔ PHỎNG GIAO DỊCH PAPER",
      last_sync: "Đồng bộ lần cuối",
      capital: "Vốn",
      not_advice: "Không phải lời khuyên tài chính",

      // Modal
      modal_title: "Ghi nhận giao dịch giả lập",
      cancel: "Hủy",
      add_trade_btn: "Thêm giao dịch",
      entry_price: "Giá Entry",
      stop_loss: "Dừng lỗ (SL)",
      take_profit: "Chốt lời (TP)",
      pnl_usd: "PnL (USD)",
      r_result: "Kết quả R"
    }
  };

  let currentLang = localStorage.getItem('trading_sim_lang') || 'en';

  window.setLanguage = function (lang) {
    currentLang = lang;
    localStorage.setItem('trading_sim_lang', lang);
    
    // Toggle active classes on toggles
    const btnEn = $('lang-btn-en');
    const btnVi = $('lang-btn-vi');
    if (btnEn) btnEn.classList.toggle('active', lang === 'en');
    if (btnVi) btnVi.classList.toggle('active', lang === 'vi');
    
    updateLanguageUI();
    
    // Rerender all dynamic elements
    renderStats();
    renderPerformanceChart();
    renderLiveSession();
    renderStrategyPerformance();
    filterAndRenderTable();
    renderReviews();
    renderPatterns();
  };

  function updateLanguageUI() {
    const dict = TRANSLATIONS[currentLang];
    
    // Static strings translation
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        const span = el.querySelector('span');
        if (span) {
          span.textContent = dict[key];
        } else {
          const svg = el.querySelector('svg');
          if (svg) {
            let textNode = el.querySelector('.btn-text') || el.querySelector('span');
            if (!textNode) {
              textNode = document.createElement('span');
              el.appendChild(textNode);
            }
            textNode.textContent = dict[key];
          } else {
            el.textContent = dict[key];
          }
        }
      }
    });

    // Placeholders translation
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) {
        el.placeholder = dict[key];
      }
    });
  }

  // ── Constants & State variables ───────────────────────────────
  const STARTING_CAPITAL = D.account?.equity_start ?? 10000;
  let activeChartType = 'equity'; // equity, r_multiple, drawdown
  let activeJournalFilter = 'all'; // all, WIN, LOSS, BE, NO-TRADE
  let mainChartInstance = null;

  // ── Helper functions ──────────────────────────────────────────
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
        return d.toLocaleDateString(currentLang === 'en' ? 'en-US' : 'vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch {
        return iso;
      }
    }
  };

  // ── 1. Update Layout Hierarchies & Render KPIs ─────────────────
  function renderStats() {
    const dict = TRANSLATIONS[currentLang];
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
      if (equitySubEl) equitySubEl.textContent = dict.starting_balance;
      if (equityBadgeEl) {
        equityBadgeEl.textContent = dict.initial;
        equityBadgeEl.className = 'kpi-badge neutral';
      }
    } else {
      const netLabel = pnl >= 0 ? dict.net_profit : dict.net_loss;
      if (equitySubEl) equitySubEl.textContent = `${pnl >= 0 ? '+' : ''}${fmt.usd(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%) ${netLabel}`;
      if (equityBadgeEl) {
        equityBadgeEl.textContent = pnl >= 0 ? dict.profit_badge : dict.loss_badge;
        equityBadgeEl.className = `kpi-badge ${pnl >= 0 ? 'positive' : 'negative'}`;
      }
    }

    // KPI 2: Win Rate (Grid breakdown)
    const winrateSubEl = $('kpi-winrate-sub');
    if (winrateSubEl) {
      winrateSubEl.textContent = totalTrades > 0 ? `${totalTrades} ${totalTrades > 1 ? dict.closed_trades : dict.closed_trade}` : dict.no_trades_yet;
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
      const avgStr = dict.avg_r_trade.replace('{r}', (totalTrades > 0 && totalR >= 0 ? '+' : '') + avgR.toFixed(2) + 'R');
      totalrSubEl.textContent = avgStr;
    }

    const totalrBadgeEl = $('kpi-totalr-badge');
    if (totalrBadgeEl) {
      const totStr = dict.total_r_badge.replace('{r}', (totalTrades > 0 && totalR >= 0 ? '+' : '') + totalR.toFixed(2) + 'R');
      totalrBadgeEl.textContent = totStr;
      totalrBadgeEl.className = `kpi-badge ${totalTrades === 0 ? 'neutral' : (totalR >= 0 ? 'positive' : 'negative')}`;
    }

    // KPI 4: Max Drawdown
    const maxDrawdown = D.cumulative_stats.max_drawdown_pct ?? 0;
    const ruleAdherence = D.cumulative_stats.rule_adherence_pct ?? 100;
    
    setText('kpi-drawdown', totalTrades > 0 ? fmt.pct(maxDrawdown) : '0.00%');
    
    const drawdownSubEl = $('kpi-drawdown-sub');
    if (drawdownSubEl) {
      drawdownSubEl.textContent = totalTrades > 0 ? dict.peak_dd_recorded : dict.no_dd_recorded;
    }

    const drawdownBadgeEl = $('kpi-drawdown-badge');
    if (drawdownBadgeEl) {
      drawdownBadgeEl.textContent = `${dict.adherence}: ${ruleAdherence}%`;
      drawdownBadgeEl.className = `kpi-badge ${totalTrades === 0 ? 'neutral' : (ruleAdherence === 100 ? 'positive' : (ruleAdherence >= 80 ? 'warning' : 'negative'))}`;
    }

    // Conditional color for Max Drawdown Card value text
    const drawdownValEl = $('kpi-drawdown');
    if (drawdownValEl) {
      drawdownValEl.className = `kpi-value ${totalTrades > 0 && maxDrawdown > 0 ? 'text-loss' : ''}`;
    }

    const drawdownCard = $('kpi-card-drawdown');
    if (drawdownCard) {
      drawdownCard.classList.toggle('kpi-card--risk', totalTrades > 0 && maxDrawdown > 0);
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

  // ── 3. Live Session Controller ────────────────────────────────
  function renderLiveSession() {
    const dict = TRANSLATIONS[currentLang];
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
      if (navPillLbl) navPillLbl.textContent = dict.offline;
      if (badgeStatus) {
        badgeStatus.textContent = dict.idle;
        badgeStatus.className = 'status-badge';
      }
      if (headerCta) {
        headerCta.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3,1 11,6 3,11"/></svg><span>${dict.start_session}</span>`;
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
      if (navPillLbl) navPillLbl.textContent = dict.scanning;
      if (badgeStatus) {
        badgeStatus.textContent = dict.scanning;
        badgeStatus.className = 'status-badge scanning';
      }
      
      setText('active-symbol', s.symbol || 'BTCUSDT');
      setText('active-strategy', dict.scanning_setups);
      
      const statVal = $('active-status');
      if (statVal) {
        statVal.textContent = dict.scanning_opportunities;
        statVal.className = 'param-val status-color-val text-warning';
      }
      setText('active-direction', '—');
      
      const activeParams = $('active-trade-params');
      if (activeParams) activeParams.classList.add('hidden');

      // Bind Run Agent on Header if not analyzed
      if (headerCta) {
        if (!s.agent_reasoning) {
          headerCta.innerHTML = `<svg class="ai-spark" width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z"/></svg><span>${dict.run_agent}</span>`;
          headerCta.onclick = triggerAgentAnalysis;
        } else {
          headerCta.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><span>${dict.close_session}</span>`;
          headerCta.onclick = closeActiveSessionSim;
        }
      }

    } else if (s.status === 'in_trade') {
      if (navPill) navPill.className = 'live-status-pill live-active';
      if (navPillLbl) navPillLbl.textContent = dict.in_trade;
      if (badgeStatus) {
        badgeStatus.textContent = dict.active;
        badgeStatus.className = 'status-badge active-trading';
      }

      setText('active-symbol', s.symbol || 'BTCUSDT');
      
      const strategyName = {
        ema_trend_v1: currentLang === 'en' ? 'EMA Trend Support (ema_trend_v1)' : 'Hỗ trợ xu hướng EMA (ema_trend_v1)',
        rsi_reversal_v1: currentLang === 'en' ? 'RSI Extremes (rsi_reversal_v1)' : 'Đảo chiều RSI (rsi_reversal_v1)',
        breakout_retest_v1: currentLang === 'en' ? 'S&R Breakout Retest (breakout_retest_v1)' : 'Kiểm thử phá vỡ S&R (breakout_retest_v1)'
      }[s.strategy] || s.strategy;

      setText('active-strategy', strategyName || '—');
      
      const statVal = $('active-status');
      if (statVal) {
        statVal.textContent = dict.in_position;
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
        headerCta.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><span>${dict.close_session}</span>`;
        headerCta.onclick = closeActiveSessionSim;
      }
    }

    // AI Reasoning sub-panel translation sync
    const aiIdle = $('ai-reasoning-idle');
    const aiLoading = $('ai-reasoning-loading');
    const aiActive = $('ai-reasoning-active');

    if (s.agent_reasoning) {
      if (aiIdle) aiIdle.classList.add('hidden');
      if (aiLoading) aiLoading.classList.add('hidden');
      if (aiActive) aiActive.classList.remove('hidden');

      setText('ai-context', currentLang === 'en' ? s.agent_reasoning.context_en : s.agent_reasoning.context_vi);
      setText('ai-setup', currentLang === 'en' ? s.agent_reasoning.setup_en : s.agent_reasoning.setup_vi);
      
      const riskEl = $('ai-risk');
      if (riskEl) {
        const riskText = currentLang === 'en' ? s.agent_reasoning.risk_en : s.agent_reasoning.risk_vi;
        if (riskText) {
          riskEl.textContent = riskText;
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

    const dict = TRANSLATIONS[currentLang];
    const ss = D.strategy_stats;
    const strategies = [
      { id: 'ema_trend_v1', name: currentLang === 'en' ? 'EMA Trend Support' : 'Hỗ trợ xu hướng EMA' },
      { id: 'rsi_reversal_v1', name: currentLang === 'en' ? 'RSI Extremes' : 'Đảo chiều RSI' },
      { id: 'breakout_retest_v1', name: currentLang === 'en' ? 'S&R Breakout Retest' : 'Kiểm thử phá vỡ S&R' },
      { id: 'no_trade', name: currentLang === 'en' ? 'No-Trade Discipline' : 'Kỷ luật đứng ngoài' }
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
                <span class="strat-metric-lbl">${isDiscipline ? (currentLang === 'en' ? 'Count' : 'Số lần') : (currentLang === 'en' ? 'Trades' : 'Lệnh')}</span>
              </div>
              <div class="strat-metric-box">
                <span class="strat-metric-val ${rClass}">${rVal}</span>
                <span class="strat-metric-lbl">${isDiscipline ? (currentLang === 'en' ? 'Result' : 'Kết quả') : (currentLang === 'en' ? 'R-PnL' : 'R-PnL')}</span>
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

    const dict = TRANSLATIONS[currentLang];
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
      if (emptyEl) {
        emptyEl.querySelector('.empty-title').textContent = dict.no_trades_logged_yet;
        emptyEl.querySelector('.empty-desc').textContent = dict.journal_empty_desc;
        emptyEl.querySelector('.btn span').textContent = dict.add_trade;
        emptyEl.classList.remove('hidden');
      }
      if (tableEl) tableEl.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (tableEl) tableEl.classList.remove('hidden');

    tbody.innerHTML = filtered.map(t => {
      const resultBadge = {
        WIN: `<span class="badge badge-win">${currentLang === 'en' ? 'WIN' : 'THẮNG'}</span>`,
        LOSS: `<span class="badge badge-loss">${currentLang === 'en' ? 'LOSS' : 'THUA'}</span>`,
        BREAKEVEN: `<span class="badge badge-be">${currentLang === 'en' ? 'BE' : 'HÒA'}</span>`,
        'NO-TRADE': `<span class="badge badge-notrade">${currentLang === 'en' ? 'NO-TRADE' : 'KỶ LUẬT'}</span>`,
        OPEN: `<span class="badge badge-be" style="color:var(--blue-hover);border-color:var(--border-hi)">OPEN</span>`
      }[t.status] || `<span class="badge badge-be">${t.status}</span>`;

      const dirBadge = t.direction === 'LONG' 
        ? `<span class="badge badge-long">${currentLang === 'en' ? 'LONG' : 'LONG'}</span>` 
        : t.direction === 'SHORT' 
          ? `<span class="badge badge-short">${currentLang === 'en' ? 'SHORT' : 'SHORT'}</span>` 
          : '<span class="badge badge-be">—</span>';

      const pnlClass = t.pnl_usd >= 0 ? 'pnl-positive' : 'pnl-negative';
      const rClass = (t.r_result ?? 0) >= 0 ? 'pnl-positive' : 'pnl-negative';

      const entryPrice = t.entry ? fmt.price(t.entry) : '—';
      const slPrice = t.sl ? fmt.price(t.sl) : '—';
      const tpPrice = t.tp ? fmt.price(t.tp) : '—';
      const rrRatio = t.rr ? `1:${parseFloat(t.rr).toFixed(1)}` : '—';
      const pnlUSD = t._type === 'trade' ? fmt.usd(t.pnl_usd) : '—';
      const rVal = t._type === 'trade' ? fmt.r(t.r_result) : '—';

      const stratDisplay = {
        ema_trend_v1: currentLang === 'en' ? 'EMA Trend Support' : 'Hỗ trợ xu hướng EMA',
        rsi_reversal_v1: currentLang === 'en' ? 'RSI Extremes' : 'Đảo chiều RSI',
        breakout_retest_v1: currentLang === 'en' ? 'S&R Breakout Retest' : 'Kiểm thử phá vỡ S&R'
      }[t.strategy] || t.strategy;

      return `
        <tr>
          <td class="mono" style="color:var(--text-muted); font-size:11px">${fmt.date(t.date || t.timestamp_entry)}</td>
          <td class="mono" style="font-weight:700">${t.symbol ?? '—'}</td>
          <td>${dirBadge}</td>
          <td style="color:var(--text-secondary); font-size:11px">${stratDisplay}</td>
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

    const dict = TRANSLATIONS[currentLang];
    const reviews = D.daily_reviews ?? [];
    if (reviews.length === 0) {
      container.innerHTML = '';
      if (emptyEl) {
        emptyEl.querySelector('.empty-title').textContent = dict.no_reviews_title;
        emptyEl.querySelector('.empty-desc').textContent = dict.reviews_empty_desc;
        emptyEl.querySelector('.btn span').textContent = dict.start_review_btn;
        emptyEl.classList.remove('hidden');
      }
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    container.innerHTML = reviews.map(r => {
      const isAllowed = r.permission_for_next_day === 'trade';
      const statusClass = isAllowed ? 'text-win' : 'text-loss';
      const statusIcon = isAllowed ? '✓' : '⚠';
      const statusText = isAllowed ? dict.trade_permitted : dict.review_shutdown;
      const lessonText = currentLang === 'en' ? (r.lesson_en || r.lesson_for_next_session) : (r.lesson_vi || r.lesson_for_next_session);

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
              <span class="review-mini-label">${currentLang === 'en' ? 'Trades' : 'Giao dịch'}</span>
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
            <p><strong>${currentLang === 'en' ? 'Lessons' : 'Bài học'}:</strong> ${lessonText || 'No specific notes logged.'}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderPatterns() {
    const grid = $('patterns-grid-container');
    const emptyEl = $('patterns-empty');
    if (!grid) return;

    const dict = TRANSLATIONS[currentLang];
    const patterns = D.patterns ?? [];
    if (patterns.length === 0) {
      grid.classList.add('hidden');
      if (emptyEl) {
        emptyEl.querySelector('.empty-title').textContent = dict.no_patterns_title;
        emptyEl.querySelector('.empty-desc').textContent = dict.patterns_empty_desc;
        emptyEl.querySelector('.btn span').textContent = dict.add_pattern_btn;
        emptyEl.classList.remove('hidden');
      }
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

      const title = currentLang === 'en' ? (p.title_en || p.title) : (p.title_vi || p.title);
      const desc = currentLang === 'en' ? (p.desc_en || p.description) : (p.desc_vi || p.description);

      return `
        <div class="pattern-library-card">
          <div>
            <div class="pattern-card-header">
              <span class="pattern-title-text">${title}</span>
              <span class="pattern-status-badge ${statusClass}">${p.status}</span>
            </div>
            <p class="pattern-card-desc">${desc}</p>
          </div>
          <div class="pattern-card-meta">
            <span>${dict.observed_lbl}: ${p.observed ?? 1}×</span>
            <span class="text-win" style="font-weight:700">${dict.win_rate_lbl}: ${p.win_rate ?? 0}%</span>
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
            context_en: 'Solid H4 bullish structure. EMA 21 & EMA 50 stacked and sloping upwards. ADX = 28.4 indicates high trend strength.',
            context_vi: 'Cấu trúc tăng H4 bền vững. Đường EMA 21 & EMA 50 xếp chồng song song hướng lên trên. Chỉ số ADX = 28.4 biểu thị xu hướng mạnh mẽ.',
            setup_en: 'Price retested dynamic support zone of EMA 21. Bullish hammer candle formed on H4 with elevated volume.',
            setup_vi: 'Giá hồi quy kỹ thuật (retest) thành công về dải hỗ trợ động EMA 21. Xuất hiện nến rút chân H4 Bullish Hammer kèm vol mua đột biến.',
            risk_en: 'Upcoming US CPI news tonight. Keep leverage conservative and monitor short-term spikes.',
            risk_vi: 'Cần chú ý tin tức CPI Mỹ được công bố tối nay. Tránh giao dịch đòn bẩy quá cao.'
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
            context_en: 'Price approaching major historical resistance. H1 RSI reached 78.5 (overbought) with clear bearish divergence.',
            context_vi: 'Giá tiệm cận vùng kháng cự ATH cứng. RSI khung H1 đạt cực đại 78.5 (Quá mua) kết hợp phân kỳ âm rõ rệt.',
            setup_en: 'Bearish engulfing candle formed at the upper bound of the ascending channel. MACD bearish crossover.',
            setup_vi: 'Nến đảo chiều Bearish Engulfing xuất hiện ở biên trên kênh giá song song. MACD giao cắt hướng xuống.',
            risk_en: 'Counter-trend trade. Strict 1% account risk limit must be enforced.',
            risk_vi: 'Đi ngược xu hướng chính H4. Tuyệt đối tuân thủ dừng lỗ tối đa 1% tài khoản.'
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
            context_en: 'Clean breakout of a 5-day symmetrical triangle pattern on the H1 timeframe.',
            context_vi: 'Giá phá vỡ thành công mô hình tam giác tích lũy (Symmetrical Triangle) kéo dài 5 ngày trên khung đồ thị H1.',
            setup_en: 'Pinbar candle retesting the upper boundary of the triangle (new dynamic support). Declining sell volume.',
            setup_vi: 'Đang hình thành nến Pinbar retest lại cạnh trên của tam giác đã phá vỡ (vùng hỗ trợ mới). Vol bán giảm dần.',
            risk_en: 'Failure to close above $68,300 invalidates the breakout setup (Fakeout risk).',
            risk_vi: 'Nếu đóng nến dưới 68,300 USD thì thiết lập breakout này thất bại (Bẫy tăng giá/Fakeout).'
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

  // Helper: Settle simulated trade
  function settleActiveTradeSim() {
    if (!D.active_session || D.active_session.status !== 'in_trade') return;

    const s = D.active_session;
    
    // Simulate rules adherence check
    const violatesRules = Math.random() < 0.15; // 15% chance of rule violation
    if (violatesRules) {
      D.cumulative_stats.rule_violations += 1;
    }
    
    const isWin = Math.random() > 0.4; // 60% win rate
    let result = 'LOSS';
    let pnl = -100;
    let r_res = -1.0;

    if (isWin) {
      result = 'WIN';
      r_res = parseFloat(s.rr || 3.0);
      pnl = 100 * r_res;
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
    
    // Update statistics
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

    // Redraw components
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
        lesson_en: 'Perfect adherence to the trading plan. Stayed calm when price approached Stop Loss and did not move the SL.',
        lesson_vi: 'Tuân thủ kế hoạch giao dịch hoàn hảo. Giữ bình tĩnh khi giá tiệm cận Stop Loss và kiên quyết không dịch SL.',
        permission: 'trade'
      },
      {
        lesson_en: 'Avoided trading during high volatility leading up to the FOMC news. Good decision to sit on hands.',
        lesson_vi: 'Tránh vào lệnh khi thị trường biến động giật mạnh trước tin tức FOMC. Nên đứng ngoài quan sát.',
        permission: 'trade'
      },
      {
        lesson_en: 'Discipline error: FOMO entry when price had already run too far from the Entry. Suspended trading for the next session.',
        lesson_vi: 'Lỗi kỷ luật: Fomo vào lệnh khi giá đã chạy quá xa điểm Entry. Phạt ngưng giao dịch 1 phiên kế tiếp.',
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
      lesson_en: pick.lesson_en,
      lesson_vi: pick.lesson_vi,
      lesson_for_next_session: pick.lesson_en // Fallback
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
        title_en: 'Bullish Flag Breakout',
        title_vi: 'Mô hình Cờ tăng phá vỡ',
        desc_en: 'Bullish flag pattern forming after a strong uptrend. Retest and breakout of the upper boundary with high volume confirms trend continuation.',
        desc_vi: 'Mô hình cờ tăng xuất hiện sau một xu hướng tăng mạnh. Phá vỡ cạnh trên cờ kèm theo khối lượng giao dịch đột biến xác nhận tiếp diễn xu hướng.',
        status: 'confirmed',
        observed: 4,
        win_rate: 75
      },
      {
        title_en: 'Double Bottom Support',
        title_vi: 'Mô hình Hai đáy hỗ trợ',
        desc_en: 'Double bottom pattern forming at H4 key support. Bullish RSI divergence provides strong reversal signals.',
        desc_vi: 'Mô hình 2 đáy hình thành tại vùng hỗ trợ cứng khung H4. RSI phân kỳ dương tạo tín hiệu mua đảo chiều mạnh mẽ.',
        status: 'probable',
        observed: 2,
        win_rate: 50
      },
      {
        title_en: 'Head and Shoulders Peak',
        title_vi: 'Mô hình Vai Đầu Vai đảo chiều',
        desc_en: 'Head and shoulders pattern indicating bearish trend reversal at structural highs. Breakdown below neckline triggers technical selloff.',
        desc_vi: 'Mô hình Vai Đầu Vai đảo chiều giảm giá tại đỉnh. Phá vỡ đường viền cổ (Neckline) kích hoạt lực bán tháo kỹ thuật.',
        status: 'hypothesis',
        observed: 1,
        win_rate: 0
      }
    ];

    const pick = patterns[Math.floor(Math.random() * patterns.length)];
    
    // Check if title already exists, increment observed
    const existing = D.patterns.find(p => p.title_en === pick.title_en);
    if (existing) {
      existing.observed += 1;
    } else {
      D.patterns.push({
        title: pick.title_en,
        title_en: pick.title_en,
        title_vi: pick.title_vi,
        description: pick.desc_en,
        desc_en: pick.desc_en,
        desc_vi: pick.desc_vi,
        status: pick.status,
        observed: pick.observed,
        win_rate: pick.win_rate
      });
    }

    D.meta.last_updated = new Date().toISOString();
    renderPatterns();
  };

  // Safe DOM setter helper
  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  // ── 8. Initial Initialization on Load ─────────────────────────
  function init() {
    // Sync active button classes based on current lang
    const btnEn = $('lang-btn-en');
    const btnVi = $('lang-btn-vi');
    if (btnEn) btnEn.classList.toggle('active', currentLang === 'en');
    if (btnVi) btnVi.classList.toggle('active', currentLang === 'vi');

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

    // Set i18n static text
    updateLanguageUI();

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
