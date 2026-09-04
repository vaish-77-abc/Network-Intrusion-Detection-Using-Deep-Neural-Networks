import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';
import { healthCheck, getModelsInfo } from '../services/api';
import { getRiskLevelFromProbability } from '../constants/riskConfig';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

function riskBadgeClass(level) {
  const map = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };
  return `risk-badge ${map[level] || 'low'}`;
}

export default function Overview() {
  const { dashboardStats, sessionPredictions, modelActivity } = useApp();
  const [apiOnline, setApiOnline] = useState(true);
  const [modelsReady, setModelsReady] = useState({ DNN: true, LSTM: true, GRU: true });

  useEffect(() => {
    async function load() {
      try {
        const health = await healthCheck();
        setApiOnline(health.status === 'healthy' || health.models_loaded);
        const info = await getModelsInfo();
        const ready = {};
        ['DNN', 'LSTM', 'GRU'].forEach((m) => { ready[m] = true; });
        info.models?.forEach((m) => { ready[m.name] = true; });
        setModelsReady(ready);
      } catch {
        setApiOnline(false);
      }
    }
    load();
  }, []);

  const totalAnalyzed = dashboardStats.total_analyzed || 0;
  const normalCount   = dashboardStats.normal_count || 0;
  const attackCount   = dashboardStats.attack_count || 0;
  const detectionRate = dashboardStats.detection_rate || 0;

  const normalPct = totalAnalyzed > 0 ? ((normalCount / totalAnalyzed) * 100).toFixed(1) : '0';
  const attackPct = totalAnalyzed > 0 ? ((attackCount / totalAnalyzed) * 100).toFixed(1) : '0';

  // ── Donut Chart ──
  const donutData = {
    labels: ['Normal Traffic', 'Attack Traffic'],
    datasets: [{
      data: totalAnalyzed > 0 ? [normalCount, attackCount] : [1, 0],
      backgroundColor: totalAnalyzed > 0 ? ['rgba(34,197,94,.85)', 'rgba(239,68,68,.85)'] : ['rgba(79,140,255,.08)'],
      borderColor: ['#080c17'],
      borderWidth: 3,
      hoverOffset: 8,
    }],
  };

  const donutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#8b9ab4', padding: 16,
          font: { size: 12, family: 'Inter' },
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(8,12,23,.95)',
        borderColor: 'rgba(79,140,255,.2)',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => {
            const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = sum > 0 ? ((ctx.parsed / sum) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
          },
        },
      },
    },
  };

  // ── Detection Timeline (from sessionPredictions) ──
  const timelineLabels = [];
  const normalLine = [];
  const attackLine = [];

  if (sessionPredictions.length > 0) {
    const reversed = [...sessionPredictions].reverse();
    reversed.forEach((p, i) => {
      timelineLabels.push(
        p.input_type === 'csv'
          ? `Batch ${i + 1}`
          : `Flow ${String(i + 1).padStart(2, '0')}`
      );
      normalLine.push(p.prediction === 'BENIGN' ? 1 : 0);
      attackLine.push(p.prediction === 'ATTACK' ? 1 : 0);
    });
  } else {
    // Empty state placeholder
    ['Flow 1–10', 'Flow 11–20', 'Flow 21–30'].forEach((l) => {
      timelineLabels.push(l);
      normalLine.push(0);
      attackLine.push(0);
    });
  }

  const lineData = {
    labels: timelineLabels,
    datasets: [
      {
        label: 'Normal Flows',
        data: normalLine,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,.07)',
        fill: true, tension: 0.35, borderWidth: 2, pointRadius: 3,
      },
      {
        label: 'Attack Flows',
        data: attackLine,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,.07)',
        fill: true, tension: 0.35, borderWidth: 2, pointRadius: 3,
      },
    ],
  };

  const lineOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#4f6070', font: { size: 11 }, maxTicksLimit: 12 } },
      y: {
        beginAtZero: true, max: 2,
        grid: { color: 'rgba(79,140,255,.05)' },
        ticks: { color: '#4f6070', precision: 0 },
      },
    },
    plugins: {
      legend: { position: 'top', labels: { color: '#8b9ab4', usePointStyle: true, font: { size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(8,12,23,.95)',
        borderColor: 'rgba(79,140,255,.2)', borderWidth: 1,
      },
    },
  };

  const recentAlerts = dashboardStats.recent_alerts || [];

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
          ANALYTICS & INTELLIGENCE
        </div>
        <h2 className="page-title">Overview</h2>
        <p className="page-subtitle">Session intelligence and network detection analytics</p>
      </div>

      {/* ── SESSION OVERVIEW ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Session Overview
          </div>
        </div>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div className="stat-card">
            <div className="stat-card-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <div className="stat-card-label">Total Traffic Analyzed</div>
              <div className="stat-card-value" style={{ fontFamily: 'var(--font-num)' }}>{totalAnalyzed.toLocaleString()}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <div className="stat-card-label">Normal Traffic</div>
              <div className="stat-card-value" style={{ color: 'var(--green)', fontFamily: 'var(--font-num)' }}>
                {normalCount.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="stat-card-label">Attacks Detected</div>
              <div className="stat-card-value" style={{ color: 'var(--red)', fontFamily: 'var(--font-num)' }}>
                {attackCount.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="stat-card-label">Detection Rate</div>
              <div className="stat-card-value" style={{ color: 'var(--purple)', fontFamily: 'var(--font-num)' }}>
                {detectionRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TRAFFIC DISTRIBUTION (large) + MODEL ACTIVITY ── */}
      <div className="grid-2-3" style={{ marginBottom: 20 }}>
        {/* Donut */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
              Traffic Distribution
            </div>
          </div>
          <div className="chart-wrap donut-lg" style={{ position: 'relative' }}>
            <Doughnut data={donutData} options={donutOpts} />
            {totalAnalyzed > 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '36%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontFamily: 'var(--font-num)', fontSize: '1.7rem', fontWeight: 900 }}>{totalAnalyzed}</div>
                <div style={{ fontSize: '.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Total</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
            <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--green)' }}>
              <div style={{ fontSize: '.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Normal</div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--green)' }}>{normalCount} <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>({normalPct}%)</span></div>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--red)' }}>
              <div style={{ fontSize: '.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Attack</div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--red)' }}>{attackCount} <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>({attackPct}%)</span></div>
            </div>
          </div>
        </div>

        {/* Model Activity + System Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                Model Activity
              </div>
            </div>
            <div className="model-activity-grid">
              {[
                { name: 'DNN', color: 'var(--dnn-color)', dim: 'var(--dnn-dim)', colorClass: 'dnn' },
                { name: 'LSTM', color: 'var(--lstm-color)', dim: 'var(--lstm-dim)', colorClass: 'lstm' },
                { name: 'GRU', color: 'var(--gru-color)', dim: 'var(--gru-dim)', colorClass: 'gru' },
              ].map(({ name, color, colorClass }) => {
                const count = modelActivity[name] || 0;
                return (
                  <div className="model-activity-row" key={name}>
                    <div className="model-activity-dot" style={{ background: color, boxShadow: `0 0 8px ${color}60` }} />
                    <div className="model-activity-name">{name}</div>
                    <div>
                      <div className="model-activity-count">{count}</div>
                      <div className="model-activity-sub">Prediction{count !== 1 ? 's' : ''}</div>
                    </div>
                    <span className={`badge badge-${colorClass}`} style={{ fontSize: '.65rem', padding: '2px 8px' }}>
                      {name === 'DNN' ? 'Single Flow' : 'Sequence'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                System Health
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="system-health-item">
                <span>API Status</span>
                <div className="system-health-status">
                  <div className={`system-health-dot ${!apiOnline ? 'offline' : ''}`} style={{ background: apiOnline ? 'var(--green)' : 'var(--red)', animation: apiOnline ? undefined : 'none' }} />
                  {apiOnline ? 'Connected' : 'Offline'}
                </div>
              </div>
              {['DNN', 'LSTM', 'GRU'].map((m) => (
                <div className="system-health-item" key={m}>
                  <span>{m} Model</span>
                  <div className="system-health-status">
                    <div className="system-health-dot" />
                    {modelsReady[m] ? 'Ready' : 'Not Loaded'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── DETECTION TIMELINE ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Detection Timeline
          </div>
          <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
            Flow / Sequence / Batch Window
          </span>
        </div>
        <div className="chart-wrap line" style={{ height: 230 }}>
          <Line data={lineData} options={lineOpts} />
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 10 }}>
          Timeline based on actual prediction records from current session. Labels use flow/batch numbers, not timestamps.
        </div>
      </div>

      {/* ── RECENT ANOMALIES TABLE ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Recent Anomalies
          </div>
          <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
            {sessionPredictions.length} record{sessionPredictions.length !== 1 ? 's' : ''} this session
          </span>
        </div>

        {sessionPredictions.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="36" height="36">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h3>No Anomaly Records</h3>
            <p>Run an analysis from the Dashboard to populate this table.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="anomalies-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Flow / Sequence</th>
                  <th>Prediction</th>
                  <th>Attack Probability</th>
                  <th>Risk Level</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {sessionPredictions.slice(0, 50).map((p, idx) => {
                  const isAtk = p.prediction === 'ATTACK';
                  const riskMeta = getRiskLevelFromProbability(p.attack_probability);
                  const riskLevel = p.risk_level || riskMeta.label;
                  const modelColorMap = { DNN: 'dnn', LSTM: 'lstm', GRU: 'gru' };
                  return (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '.78rem' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-num)', fontSize: '.8rem' }}>
                        {p.input_type === 'csv'
                          ? `Batch (${p.flows_analyzed} flows)`
                          : p.flows_analyzed > 1
                          ? `Sequence (${p.flows_analyzed} flows)`
                          : 'Single Flow'}
                      </td>
                      <td>
                        <span className={`badge ${isAtk ? 'badge-danger' : 'badge-success'}`}>
                          {p.prediction}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-num)', fontWeight: 700, color: isAtk ? 'var(--red)' : 'var(--text-secondary)' }}>
                        {(p.attack_probability * 100).toFixed(2)}%
                      </td>
                      <td>
                        <span className={riskBadgeClass(riskLevel)}>{riskLevel}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${modelColorMap[p.model] || 'info'}`}>{p.model}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ALL RECENT ALERTS from server ── */}
      {recentAlerts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Alert Feed
            </div>
          </div>
          <div className="alert-feed">
            {recentAlerts.map((a, idx) => {
              const isAtk = a.prediction === 'ATTACK';
              const logRisk = a.risk_level || (a.attack_probability > 0.85 ? 'CRITICAL' : a.attack_probability > 0.6 ? 'HIGH' : a.attack_probability > 0.3 ? 'MEDIUM' : 'LOW');
              const confidence = ((isAtk ? a.attack_probability : (1 - a.attack_probability)) * 100).toFixed(1);
              return (
                <div className="alert-row" key={a.id || idx}>
                  <div className={`alert-row-dot ${isAtk ? 'red' : 'green'}`} />
                  <div className="alert-row-content">
                    <div className="alert-row-title">
                      {isAtk ? 'Attack Detected' : 'Normal Traffic'}
                    </div>
                    <div className="alert-row-sub">
                      Model: <strong>{a.model}</strong> • Confidence: {confidence}%
                    </div>
                  </div>
                  <div className="alert-row-badge">
                    <span className={riskBadgeClass(logRisk)} style={{ fontSize: '.65rem', padding: '3px 8px' }}>
                      {logRisk}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
