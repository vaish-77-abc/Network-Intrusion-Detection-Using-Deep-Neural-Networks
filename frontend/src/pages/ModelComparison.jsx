import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getModelComparison } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const FALLBACK = {
  DNN:  { accuracy: 98.8725, precision: 98.3283, recall: 99.4365, f1_score: 98.8793 },
  LSTM: { accuracy: 99.2556, precision: 99.5417, recall: 98.9688, f1_score: 99.2544 },
  GRU:  { accuracy: 99.0947, precision: 99.5882, recall: 98.5971, f1_score: 99.0902 },
  best_accuracy: 'LSTM',
  best_precision: 'GRU',
  best_recall: 'DNN',
  best_f1: 'LSTM',
};

function MetricBar({ value, color, min = 98, max = 100 }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="metric-bar-wrap">
      <div className="metric-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function ModelComparison() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModelComparison()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const m = data || FALLBACK;

  const MODELS = [
    {
      key: 'DNN', label: 'DNN', arch: 'Feedforward Neural Network',
      input: '1 × 78', colorClass: 'dnn', color: '#4f8cff',
      metrics: m.DNN,
      bests: { accuracy: m.best_accuracy === 'DNN', precision: m.best_precision === 'DNN', recall: m.best_recall === 'DNN', f1: m.best_f1 === 'DNN' },
    },
    {
      key: 'LSTM', label: 'LSTM', arch: 'Recurrent Neural Network',
      input: '1 × 10 × 78', colorClass: 'lstm', color: '#7c3aed',
      metrics: m.LSTM,
      bests: { accuracy: m.best_accuracy === 'LSTM', precision: m.best_precision === 'LSTM', recall: m.best_recall === 'LSTM', f1: m.best_f1 === 'LSTM' },
    },
    {
      key: 'GRU', label: 'GRU', arch: 'Gated Recurrent Network',
      input: '1 × 10 × 78', colorClass: 'gru', color: '#06b6d4',
      metrics: m.GRU,
      bests: { accuracy: m.best_accuracy === 'GRU', precision: m.best_precision === 'GRU', recall: m.best_recall === 'GRU', f1: m.best_f1 === 'GRU' },
    },
  ];

  // Bar chart
  const chartData = {
    labels: ['DNN', 'LSTM', 'GRU'],
    datasets: [
      {
        label: 'Accuracy',
        data: [m.DNN.accuracy, m.LSTM.accuracy, m.GRU.accuracy],
        backgroundColor: 'rgba(79,140,255,.8)',
        borderRadius: 4,
      },
      {
        label: 'Precision',
        data: [m.DNN.precision, m.LSTM.precision, m.GRU.precision],
        backgroundColor: 'rgba(124,58,237,.8)',
        borderRadius: 4,
      },
      {
        label: 'Recall',
        data: [m.DNN.recall, m.LSTM.recall, m.GRU.recall],
        backgroundColor: 'rgba(6,182,212,.8)',
        borderRadius: 4,
      },
      {
        label: 'F1 Score',
        data: [m.DNN.f1_score, m.LSTM.f1_score, m.GRU.f1_score],
        backgroundColor: 'rgba(245,158,11,.8)',
        borderRadius: 4,
      },
    ],
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: '#8b9ab4', font: { weight: '700', family: 'Space Grotesk' } } },
      y: {
        min: 97, max: 100,
        grid: { color: 'rgba(79,140,255,.06)' },
        ticks: { color: '#4f6070', callback: (v) => `${v}%` },
      },
    },
    plugins: {
      legend: { position: 'top', labels: { color: '#8b9ab4', usePointStyle: true, font: { size: 12 } } },
      tooltip: {
        backgroundColor: 'rgba(8,12,23,.95)',
        borderColor: 'rgba(79,140,255,.2)', borderWidth: 1,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(4)}%` },
      },
    },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
          PERFORMANCE BENCHMARKS
        </div>
        <h2 className="page-title">Model Comparison</h2>
        <p className="page-subtitle">Test set performance metrics for DNN, LSTM, and GRU models on CIC-IDS-2017</p>
      </div>

      {/* ── Test set notice ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(79,140,255,.06)', border: '1px solid rgba(79,140,255,.12)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: '.78rem', color: 'var(--text-secondary)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span><strong>TEST SET PERFORMANCE</strong> — Metrics evaluated on the CIC-IDS-2017 test set. These are not individual prediction confidence values.</span>
      </div>

      {/* ── Model Metric Cards ── */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {MODELS.map(({ key, label, arch, input, colorClass, color, metrics, bests }) => (
          <div key={key} className={`model-metric-card ${colorClass}`}>
            <div className="model-metric-header">
              <div className={`model-metric-dot ${colorClass}`} />
              <div>
                <div className="model-metric-name">{label}</div>
                <div className="model-metric-arch">{arch}</div>
              </div>
            </div>

            <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: 14, padding: '6px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 6 }}>
              Input: <code style={{ color, fontFamily: 'monospace', fontSize: '.72rem' }}>{input}</code>
            </div>

            <div className="metric-rows">
              {[
                { key2: 'accuracy', label2: 'Accuracy', val: metrics.accuracy, best: bests.accuracy },
                { key2: 'precision', label2: 'Precision', val: metrics.precision, best: bests.precision },
                { key2: 'recall', label2: 'Recall', val: metrics.recall, best: bests.recall },
                { key2: 'f1', label2: 'F1 Score', val: metrics.f1_score, best: bests.f1 },
              ].map(({ key2, label2, val, best }) => (
                <div key={key2}>
                  <div className="metric-row">
                    <div className="metric-label">{label2}</div>
                    <div style={{ display: 'flex', align: 'center', gap: 8 }}>
                      {best && <span className="metric-best-flag">★ BEST</span>}
                      <div className="metric-value" style={{ color: best ? color : undefined }}>
                        {val.toFixed(4)}%
                      </div>
                    </div>
                  </div>
                  <MetricBar value={val} color={color} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Comparison Bar Chart ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Performance Chart
          </div>
          <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Test Set Evaluation</span>
        </div>
        <div className="chart-wrap bar">
          <Bar data={chartData} options={chartOpts} />
        </div>
      </div>

      {/* ── Detailed Table ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Comprehensive Evaluation Metrics</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Architecture</th>
                <th>Input Shape</th>
                <th>Accuracy (%)</th>
                <th>Precision (%)</th>
                <th>Recall (%)</th>
                <th>F1 Score (%)</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map(({ key, label, arch, input, metrics, bests, color }) => (
                <tr key={key}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <strong style={{ color: 'var(--text-primary)' }}>{label}</strong>
                    </div>
                  </td>
                  <td>{arch}</td>
                  <td><code>{input}</code></td>
                  <td className={bests.accuracy ? 'best' : ''}>
                    {metrics.accuracy.toFixed(4)}{bests.accuracy && ' ★'}
                  </td>
                  <td className={bests.precision ? 'best' : ''}>
                    {metrics.precision.toFixed(4)}{bests.precision && ' ★'}
                  </td>
                  <td className={bests.recall ? 'best' : ''}>
                    {metrics.recall.toFixed(4)}{bests.recall && ' ★'}
                  </td>
                  <td className={bests.f1 ? 'best' : ''}>
                    {metrics.f1_score.toFixed(4)}{bests.f1 && ' ★'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Key Findings ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Key Findings
          </div>
        </div>
        <div className="grid-3">
          <div style={{ padding: '16px 18px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--lstm-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lstm-color)' }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '.88rem', fontWeight: 700, color: 'var(--lstm-color)' }}>LSTM — Best Overall</span>
            </div>
            <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Highest accuracy (<strong>{m.LSTM.accuracy.toFixed(4)}%</strong>) and F1 score (<strong>{m.LSTM.f1_score.toFixed(4)}%</strong>) by capturing temporal dependencies across consecutive network flows.
            </p>
          </div>

          <div style={{ padding: '16px 18px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--gru-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gru-color)' }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '.88rem', fontWeight: 700, color: 'var(--gru-color)' }}>GRU — Highest Precision</span>
            </div>
            <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Highest precision (<strong>{m.GRU.precision.toFixed(4)}%</strong>) resulting in fewer false positives while maintaining a lower parameter footprint.
            </p>
          </div>

          <div style={{ padding: '16px 18px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--dnn-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dnn-color)' }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '.88rem', fontWeight: 700, color: 'var(--dnn-color)' }}>DNN — Highest Recall</span>
            </div>
            <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Highest recall (<strong>{m.DNN.recall.toFixed(4)}%</strong>) identifying the maximum percentage of malicious traffic on single-flow inspection.
            </p>
          </div>
        </div>
      </div>

      {/* ── Architecture Summary ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Architecture Summary</div>
        </div>
        <div className="grid-3">
          {[
            { label: 'DNN', color: 'var(--dnn-color)', dim: 'var(--dnn-dim)', desc: 'Feedforward Dense (128-64-32-1)', shape: '(78,)', detail: 'Processes individual network flows. Single-pass classification for fast inference.' },
            { label: 'LSTM', color: 'var(--lstm-color)', dim: 'var(--lstm-dim)', desc: '64 Units + 32 ReLU + Dropout', shape: '(10, 78)', detail: 'Recurrent architecture capturing temporal dependencies across 10 consecutive flows.' },
            { label: 'GRU', color: 'var(--gru-color)', dim: 'var(--gru-dim)', desc: '64 Units + 32 ReLU + Dropout', shape: '(10, 78)', detail: 'Efficient gated recurrent unit with fewer parameters than LSTM, maintaining high precision.' },
          ].map(({ label, color, dim, desc, shape, detail }) => (
            <div key={label} style={{ padding: '16px', background: dim, border: `1px solid ${color}30`, borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '.92rem', fontWeight: 800, color, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--text-muted)', marginBottom: 6 }}>{desc}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{detail}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>
                Input shape: <code style={{ color, fontSize: '.72rem' }}>{shape}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
