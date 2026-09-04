import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';
import {
  healthCheck,
  predictDNN,
  predictLSTM,
  predictGRU,
  predictCSV,
} from '../services/api';
import { FEATURE_GROUPS, ALL_FEATURES, SAMPLE_DATA } from '../constants/features';
import { RISK_THRESHOLDS, getRiskLevelFromProbability } from '../constants/riskConfig';

ChartJS.register(ArcElement, Tooltip, Legend);

// ─── Risk Helpers ─────────────────────────────────────────────
function riskBadgeClass(level) {
  const map = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };
  return `risk-badge ${map[level] || 'low'}`;
}

// ─── Probability Ring SVG ─────────────────────────────────────
function ProbRing({ probability, isAttack }) {
  const pct = Math.max(0, Math.min(100, probability * 100));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = isAttack ? '#ef4444' : '#22c55e';

  return (
    <div className="prob-ring-wrap">
      <svg viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)`, transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div className="prob-ring-center">
        <div className="prob-ring-pct" style={{ color }}>{pct.toFixed(1)}%</div>
        <div className="prob-ring-label">{isAttack ? 'Attack Prob' : 'Benign Prob'}</div>
      </div>
    </div>
  );
}

// ─── Processing Step Config ───────────────────────────────────
function getStages(model, inputMethod) {
  if (inputMethod === 'csv') {
    return [
      'Reading CSV',
      'Validating 78 Features',
      'Processing Flows',
      'Creating Sequences',
      `Running ${model} Inference`,
      'Generating Results',
    ];
  }
  return [
    'Input Validation',
    'Feature Preparation',
    'Data Normalization',
    `${model} Model Inference`,
    'Security Assessment',
  ];
}

// ─── Dashboard Component ──────────────────────────────────────
export default function Dashboard() {
  const { dashboardStats, addPredictionRecord, showToast, resetSession } = useApp();
  const navigate = useNavigate();

  // ── Model & Input state ──
  const [selectedModel, setSelectedModel] = useState('DNN');
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' | 'csv'
  const isSeqModel = selectedModel === 'LSTM' || selectedModel === 'GRU';

  // ── Manual feature state ──
  const [activeFlowTab, setActiveFlowTab] = useState(0);
  const [flows, setFlows] = useState(() =>
    Array.from({ length: 10 }, () => {
      const obj = {};
      ALL_FEATURES.forEach((f) => { obj[f] = 0; });
      return obj;
    })
  );
  const [expandedGroups, setExpandedGroups] = useState({});
  const [sampleLoaded, setSampleLoaded] = useState(false);

  // ── CSV state ──
  const [csvFile, setCsvFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Processing state ──
  const [processing, setProcessing] = useState(false);
  const [procStage, setProcStage] = useState(0);
  const [procProgress, setProcProgress] = useState(0);
  const [procStatus, setProcStatus] = useState('');

  // ── Result state ──
  const [result, setResult] = useState(null);
  const [isBatch, setIsBatch] = useState(false);

  // ── API status ──
  const [apiOnline, setApiOnline] = useState(true);

  const processingRef = useRef(null);
  const resultRef = useRef(null);

  // ── Load initial stats ──
  useEffect(() => {
    async function init() {
      try {
        await healthCheck();
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    }
    init();
  }, []);

  // ── Reload stats after prediction ──
  const refreshStats = useCallback(async () => {
    // Derived automatically from sessionPredictions now
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Manual Input Handlers
  // ─────────────────────────────────────────────────────────────
  const handleFeatureChange = (feat, val) => {
    const num = parseFloat(val) || 0;
    setFlows((prev) => {
      const next = [...prev];
      next[activeFlowTab] = { ...next[activeFlowTab], [feat]: num };
      return next;
    });
    setSampleLoaded(false);
  };

  const handleLoadSample = () => {
    setFlows(Array.from({ length: 10 }, () => ({ ...SAMPLE_DATA })));
    setSampleLoaded(true);
  };

  const handleReset = () => {
    setFlows(
      Array.from({ length: 10 }, () => {
        const obj = {};
        ALL_FEATURES.forEach((f) => { obj[f] = 0; });
        return obj;
      })
    );
    setCsvFile(null);
    setSampleLoaded(false);
    setResult(null);
    setIsBatch(false);
  };

  const toggleGroup = (idx) => {
    setExpandedGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ─────────────────────────────────────────────────────────────
  // Analyze Traffic
  // ─────────────────────────────────────────────────────────────
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (inputMethod === 'csv' && !csvFile) {
      showToast('Please upload a CSV file before analyzing.', 'error');
      return;
    }
    if (!apiOnline) {
      showToast('Unable to connect to prediction server. Please ensure FastAPI is running.', 'error');
      return;
    }

    setProcessing(true);
    setProcStage(0);
    setProcProgress(5);
    setProcStatus('');

    setTimeout(() => {
      processingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    const stages = getStages(selectedModel, inputMethod);

    // Build real API call (kicks off immediately)
    let apiPromise;
    if (inputMethod === 'csv') {
      apiPromise = predictCSV(csvFile, selectedModel);
    } else if (selectedModel === 'DNN') {
      const features = ALL_FEATURES.map((f) => flows[0][f] ?? 0);
      apiPromise = predictDNN(features);
    } else if (selectedModel === 'LSTM') {
      const seqs = flows.map((fl) => ALL_FEATURES.map((f) => fl[f] ?? 0));
      apiPromise = predictLSTM(seqs);
    } else {
      const seqs = flows.map((fl) => ALL_FEATURES.map((f) => fl[f] ?? 0));
      apiPromise = predictGRU(seqs);
    }

    try {
      // Animate through preliminary stages while API is running
      for (let i = 0; i < stages.length - 1; i++) {
        setProcStage(i);
        setProcStatus(stages[i]);
        setProcProgress(Math.round(10 + (i / (stages.length - 1)) * 75));
        await new Promise((r) => setTimeout(r, 280));
      }

      // Await actual API response
      const apiData = await apiPromise;

      // Complete final stage
      setProcStage(stages.length - 1);
      setProcStatus(stages[stages.length - 1]);
      setProcProgress(100);
      await new Promise((r) => setTimeout(r, 350));

      // Store result
      if (inputMethod === 'csv') {
        setIsBatch(true);
        setResult(apiData);
        // Add bulk prediction record
        addPredictionRecord({
          model: selectedModel,
          prediction: apiData.attack_count > 0 ? 'ATTACK' : 'BENIGN',
          attack_probability: apiData.attack_percentage / 100,
          risk_level: apiData.attack_count > 0 ? 'HIGH' : 'LOW',
          flows_analyzed: apiData.total_predictions,
          attacks_detected: apiData.attack_count,
          benign_detected: apiData.normal_count,
          input_type: 'csv',
        });
        showToast(
          `Batch analysis complete: ${apiData.total_predictions} flows evaluated.`,
          'success'
        );
      } else {
        setIsBatch(false);
        setResult(apiData);
        addPredictionRecord({
          model: apiData.model || selectedModel,
          prediction: apiData.prediction,
          attack_probability: apiData.attack_probability,
          risk_level: apiData.risk_level || getRiskLevelFromProbability(apiData.attack_probability).label,
          flows_analyzed: apiData.flows_analyzed ?? (isSeqModel ? 10 : 1),
          attacks_detected: apiData.attacks_detected ?? (apiData.prediction === 'ATTACK' ? (isSeqModel ? 10 : 1) : 0),
          benign_detected: apiData.benign_detected ?? (apiData.prediction === 'BENIGN' ? (isSeqModel ? 10 : 1) : 0),
          input_type: 'manual',
        });
        showToast(
          `Analysis complete — ${apiData.prediction === 'ATTACK' ? '⚠ Attack detected' : '✓ Benign traffic'}`,
          apiData.prediction === 'ATTACK' ? 'error' : 'success'
        );
      }

      await refreshStats();
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      const msg = err.message || 'Detection failed. Please verify your input.';
      if (msg.toLowerCase().includes('connect') || msg.toLowerCase().includes('network')) {
        showToast('Unable to connect to prediction server. Please ensure FastAPI is running.', 'error');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────
  const attackProb = result && !isBatch ? Number(result.attack_probability) : 0;
  const normalProb = result && !isBatch ? Number(result.normal_probability ?? (1 - attackProb)) : 0;
  const riskMeta = result && !isBatch
    ? (RISK_THRESHOLDS[result.risk_level] || getRiskLevelFromProbability(attackProb))
    : null;

  const totalAnalyzed = dashboardStats.total_analyzed || 0;
  const normalCount = dashboardStats.normal_count || 0;
  const attackCount = dashboardStats.attack_count || 0;
  const detectionRate = dashboardStats.detection_rate || 0;

  const donutData = {
    labels: ['Normal Traffic', 'Attack Traffic'],
    datasets: [{
      data: totalAnalyzed > 0 ? [normalCount, attackCount] : [1, 0],
      backgroundColor: totalAnalyzed > 0
        ? ['rgba(34,197,94,.8)', 'rgba(239,68,68,.8)']
        : ['rgba(79,140,255,.1)'],
      borderColor: ['#080c17'],
      borderWidth: 3,
      hoverOffset: 6,
    }],
  };

  const donutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#8b9ab4',
          padding: 12,
          font: { size: 11, family: 'Inter' },
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

  const recentAlerts = dashboardStats.recent_alerts || [];

  // ─────────────────────────────────────────────────────────────
  // Model card active class helper
  // ─────────────────────────────────────────────────────────────
  function modelCardClass(model) {
    if (selectedModel !== model) return 'model-card';
    if (model === 'DNN') return 'model-card active';
    if (model === 'LSTM') return 'model-card active-lstm';
    return 'model-card active-gru';
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page Header ── */}
      <div className="dash-header">
        <div>
          <div style={{ fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
            AI-POWERED INTRUSION DETECTION
          </div>
          <h2 className="page-title">Network Intrusion Detection</h2>
          <p className="page-subtitle">
            AI-powered network traffic analysis using deep learning
          </p>
        </div>
        <div className="dash-header-status">
          <div className="dash-status-row">
            <div className={`dot ${apiOnline ? '' : 'offline'}`} />
            {apiOnline ? 'API Connected' : 'API Offline'}
          </div>
          <div className="dash-status-row">
            <div className={`dot ${apiOnline ? '' : 'offline'}`} />
            3 Models Ready
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MAIN ANALYSIS WORKSPACE
          ══════════════════════════════════════════════════════ */}
      <form onSubmit={handleAnalyze}>

        {/* ── STEP 1: Model Selection ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="step-label">Step 1</div>
          <div className="step-title">Select Deep Learning Model</div>

          <div className="model-cards-grid">
            {/* DNN */}
            <div
              className={modelCardClass('DNN')}
              onClick={() => { setSelectedModel('DNN'); setSampleLoaded(false); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedModel('DNN')}
            >
              <div className="model-card-badge dnn" />
              <div className="model-card-icon dnn">DNN</div>
              <div className="model-card-name">DNN</div>
              <div className="model-card-arch">Feedforward Neural Network</div>
              <div className="model-card-meta">
                <div className="model-card-chip">
                  <span style={{ background: 'var(--dnn-color)' }} />
                  78 Features
                </div>
                <div className="model-card-chip">
                  <span style={{ background: 'rgba(79,140,255,.4)' }} />
                  Single Flow
                </div>
              </div>
            </div>

            {/* LSTM */}
            <div
              className={modelCardClass('LSTM')}
              onClick={() => { setSelectedModel('LSTM'); setSampleLoaded(false); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedModel('LSTM')}
            >
              <div className="model-card-badge lstm" />
              <div className="model-card-icon lstm">LSTM</div>
              <div className="model-card-name">LSTM</div>
              <div className="model-card-arch">Recurrent Neural Network</div>
              <div className="model-card-meta">
                <div className="model-card-chip">
                  <span style={{ background: 'var(--lstm-color)' }} />
                  10 Flows
                </div>
                <div className="model-card-chip">
                  <span style={{ background: 'rgba(124,58,237,.4)' }} />
                  Sequence-based analysis
                </div>
              </div>
            </div>

            {/* GRU */}
            <div
              className={modelCardClass('GRU')}
              onClick={() => { setSelectedModel('GRU'); setSampleLoaded(false); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedModel('GRU')}
            >
              <div className="model-card-badge gru" />
              <div className="model-card-icon gru">GRU</div>
              <div className="model-card-name">GRU</div>
              <div className="model-card-arch">Gated Recurrent Network</div>
              <div className="model-card-meta">
                <div className="model-card-chip">
                  <span style={{ background: 'var(--gru-color)' }} />
                  10 Flows
                </div>
                <div className="model-card-chip">
                  <span style={{ background: 'rgba(6,182,212,.4)' }} />
                  Sequence-based analysis
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── STEP 2: Input Method ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="step-label">Step 2</div>
          <div className="step-title">Select Input Method</div>

          <div className="method-tabs">
            <button
              type="button"
              className={`method-tab-btn ${inputMethod === 'manual' ? 'active' : ''}`}
              onClick={() => setInputMethod('manual')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Manual Input
            </button>
            <button
              type="button"
              className={`method-tab-btn ${inputMethod === 'csv' ? 'active' : ''}`}
              onClick={() => setInputMethod('csv')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Upload CSV
            </button>
          </div>
        </div>

        {/* ── STEP 3: Input Data ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="step-label">Step 3</div>
          <div className="step-title">
            {inputMethod === 'manual'
              ? 'Network Flow Features'
              : 'Upload Network Traffic CSV'}
          </div>

          {inputMethod === 'manual' ? (
            <div>
              {/* Sequence model banner */}
              {isSeqModel && (
                <div className={`sequence-banner ${selectedModel === 'GRU' ? 'gru' : ''}`}>
                  <div className="sequence-banner-icon">⟳</div>
                  <div>
                    <div className="sequence-banner-text">10-FLOW SEQUENCE REQUIRED</div>
                    <div className="sequence-banner-sub">
                      {selectedModel} analyzes 10 consecutive network flows (10 × 78 features)
                    </div>
                  </div>
                </div>
              )}

              {/* Flow tabs for LSTM/GRU */}
              {isSeqModel && (
                <div className="flow-tabs">
                  {Array.from({ length: 10 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`flow-tab-btn ${activeFlowTab === i
                          ? selectedModel === 'GRU'
                            ? 'active-gru'
                            : 'active'
                          : ''
                        }`}
                      onClick={() => setActiveFlowTab(i)}
                    >
                      Flow {String(i + 1).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              )}

              {/* Sample loaded notice */}
              {sampleLoaded && (
                <div className="sample-loaded-banner">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {isSeqModel
                    ? '✓ Sample sequence loaded — 10 flows × 78 features populated'
                    : '✓ Sample flow loaded — 78/78 features populated'}
                </div>
              )}

              {/* Quick actions */}
              <div className="quick-actions">
                <span className="quick-actions-label">
                  Editing: {isSeqModel ? `Flow ${String(activeFlowTab + 1).padStart(2, '0')} of 10` : 'Single Flow'}
                  {isSeqModel && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>• 10 flows × 78 features</span>}
                </span>
                <div className="quick-actions-btns">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadSample}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    {isSeqModel ? 'Load Sample Sequence' : 'Load Sample Data'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-4.54" />
                    </svg>
                    Reset
                  </button>
                </div>
              </div>

              {/* Accordion feature groups */}
              <div className="features-accordion">
                {FEATURE_GROUPS.map((grp, gIdx) => {
                  const isOpen = !!expandedGroups[gIdx];
                  return (
                    <div className="feature-group-card" key={grp.title}>
                      <div
                        className="feature-group-header"
                        onClick={() => toggleGroup(gIdx)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="feature-group-dot" />
                          {grp.title}
                          <span style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>
                            ({grp.features.length})
                          </span>
                        </span>
                        <span className="feature-group-toggle">
                          {isOpen ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                          )}
                          {isOpen ? 'Collapse' : 'Expand'}
                        </span>
                      </div>
                      {isOpen && (
                        <div className="feature-grid-inputs">
                          {grp.features.map((feat) => (
                            <div className="input-micro-group" key={feat}>
                              <label className="input-micro-label" title={feat}>{feat}</label>
                              <input
                                type="number"
                                step="any"
                                className="input-micro-field"
                                value={flows[activeFlowTab][feat] ?? 0}
                                onChange={(e) => handleFeatureChange(feat, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* CSV Upload */
            <div>
              <div
                className={`upload-zone ${isDragging ? 'dragging' : ''} ${csvFile ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.name.endsWith('.csv')) setCsvFile(f);
                  else showToast('Please upload a .csv file.', 'error');
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setCsvFile(f);
                  }}
                />
                <div className="upload-icon">
                  {csvFile ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  )}
                </div>
                <div className="upload-title">
                  {csvFile ? csvFile.name : 'Upload Network Traffic CSV'}
                </div>
                <div className="upload-subtitle">
                  {csvFile
                    ? `${(csvFile.size / 1024).toFixed(1)} KB • Ready for ${selectedModel} analysis`
                    : 'Drag & Drop CSV here or click to browse'}
                </div>
                {!csvFile && (
                  <div className="upload-browse-btn" onClick={(e) => e.stopPropagation()}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Browse File
                  </div>
                )}
              </div>

              {csvFile && (
                <div className="csv-status-list">
                  <div className="csv-status-row"><span className="csv-status-check">✓</span> File selected</div>
                  <div className="csv-status-row"><span className="csv-status-check">✓</span> Required features detected</div>
                  <div className="csv-status-row"><span className="csv-status-check">✓</span> Feature validation passed</div>

                  <div className="csv-meta-grid" style={{ gridTemplateColumns: isSeqModel ? 'repeat(4,1fr)' : 'repeat(3,1fr)' }}>
                    <div className="csv-meta-item">
                      <div className="csv-meta-label">File</div>
                      <div className="csv-meta-value" style={{ fontSize: '.75rem' }}>{csvFile.name}</div>
                    </div>
                    <div className="csv-meta-item">
                      <div className="csv-meta-label">Features</div>
                      <div className="csv-meta-value">78</div>
                    </div>
                    <div className="csv-meta-item">
                      <div className="csv-meta-label">Model</div>
                      <div className="csv-meta-value">{selectedModel}</div>
                    </div>
                    {isSeqModel && (
                      <div className="csv-meta-item">
                        <div className="csv-meta-label">Sequence</div>
                        <div className="csv-meta-value">10 flows</div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setCsvFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  >
                    Remove File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Analyze Button ── */}
        <button
          type="submit"
          className={`analyze-btn ${selectedModel.toLowerCase()}`}
          disabled={processing || (inputMethod === 'csv' && !csvFile)}
          style={{ marginBottom: 24 }}
        >
          {processing ? (
            <>
              <div className="spinner" style={{ width: 20, height: 20 }} />
              Analyzing...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              Analyze Traffic with {selectedModel}
            </>
          )}
        </button>
      </form>

      {/* ══════════════════════════════════════════════════════
          PROCESSING PANEL (visible while API is pending)
          ══════════════════════════════════════════════════════ */}
      {processing && (
        <div className="processing-panel" ref={processingRef}>
          <div className="processing-header">
            <div>
              <div className="processing-title">ANALYZING NETWORK TRAFFIC</div>
              <div className="processing-subtitle">
                {procStatus || `Running ${selectedModel} inference...`}
              </div>
            </div>
            <div className="processing-pulse" />
          </div>

          <div className="processing-stages">
            {getStages(selectedModel, inputMethod).map((stageName, idx) => {
              const done = procStage > idx;
              const active = procStage === idx;
              return (
                <div key={stageName} className="processing-stage">
                  <div className={`stage-name ${done ? 'done' : active ? 'active' : ''}`}>
                    <div className="stage-icon">
                      {done ? (
                        <span className="stage-indicator-check">✓</span>
                      ) : active ? (
                        <div className="stage-spinner" />
                      ) : (
                        <span className="stage-indicator-pending">○</span>
                      )}
                    </div>
                    {stageName}
                  </div>
                  <div style={{ fontSize: '.7rem', color: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--text-muted)', fontWeight: done ? 700 : 400 }}>
                    {done ? '✓' : active ? '◉' : '○'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${procProgress}%` }} />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PREDICTION RESULT
          ══════════════════════════════════════════════════════ */}
      {result && !processing && (
        <div
          ref={resultRef}
          className={`result-panel ${isBatch
              ? result.attack_count > 0 ? 'attack' : 'benign'
              : result.prediction === 'ATTACK' ? 'attack' : 'benign'
            }`}
          style={{ marginBottom: 24 }}
        >
          <div
            style={{
              fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase',
              color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12,
            }}
          >
            PREDICTION RESULT
          </div>

          <div className="result-panel-inner">
            {/* Left: Verdict + Meta */}
            <div className="verdict-col">
              <div
                className={`verdict-badge ${isBatch
                    ? result.attack_count > 0 ? 'attack' : 'benign'
                    : result.prediction === 'ATTACK' ? 'attack' : 'benign'
                  }`}
              >
                <span className="verdict-icon">
                  {isBatch
                    ? result.attack_count > 0 ? '⚠' : '✓'
                    : result.prediction === 'ATTACK' ? '⚠' : '✓'}
                </span>
                {isBatch
                  ? result.attack_count > 0
                    ? `ATTACK DETECTED (${result.attack_count})`
                    : 'ALL FLOWS BENIGN'
                  : result.prediction === 'ATTACK'
                    ? 'ATTACK DETECTED'
                    : 'BENIGN TRAFFIC'}
              </div>

              <div className="result-meta-grid">
                <div className="result-meta-item">
                  <div className="result-meta-label">Model</div>
                  <div className="result-meta-value" style={{ color: selectedModel === 'DNN' ? 'var(--dnn-color)' : selectedModel === 'LSTM' ? 'var(--lstm-color)' : 'var(--gru-color)' }}>
                    {result.model || selectedModel}
                  </div>
                </div>
                <div className="result-meta-item">
                  <div className="result-meta-label">Model-based Risk Level</div>
                  <div className="result-meta-value">
                    {riskMeta && <span className={riskBadgeClass(riskMeta.label)}>{riskMeta.label}</span>}
                    {isBatch && <span className={riskBadgeClass(result.attack_count > 0 ? 'HIGH' : 'LOW')}>{result.attack_count > 0 ? 'HIGH' : 'LOW'}</span>}
                  </div>
                </div>
                <div className="result-meta-item">
                  <div className="result-meta-label">Flows Analyzed</div>
                  <div className="result-meta-value" style={{ fontFamily: 'var(--font-num)' }}>
                    {isBatch
                      ? result.total_predictions.toLocaleString()
                      : (result.flows_analyzed || (isSeqModel ? 10 : 1))}
                  </div>
                </div>
                <div className="result-meta-item">
                  <div className="result-meta-label">Attack Type</div>
                  <div className="result-meta-value" style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                    Not Classified
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Probability Ring (single prediction only) */}
            {!isBatch && (
              <div className="prob-ring-col">
                <ProbRing
                  probability={result.prediction === 'ATTACK' ? attackProb : normalProb}
                  isAttack={result.prediction === 'ATTACK'}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
                    Benign Probability
                  </div>
                  <div style={{ fontFamily: 'var(--font-num)', fontSize: '.95rem', fontWeight: 700, color: 'var(--green)' }}>
                    {(normalProb * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
            )}

            {/* Right: Batch summary / benign prob */}
            <div className="verdict-col">
              {isBatch ? (
                <div className="result-meta-grid">
                  <div className="result-meta-item">
                    <div className="result-meta-label">Attack Probability</div>
                    <div className="result-meta-value" style={{ color: 'var(--red)', fontFamily: 'var(--font-num)' }}>
                      {result.attack_percentage}%
                    </div>
                  </div>
                  <div className="result-meta-item">
                    <div className="result-meta-label">Benign Flows</div>
                    <div className="result-meta-value" style={{ color: 'var(--green)', fontFamily: 'var(--font-num)' }}>
                      {result.normal_count}
                    </div>
                  </div>
                  <div className="result-meta-item">
                    <div className="result-meta-label">Attacks Detected</div>
                    <div className="result-meta-value" style={{ color: 'var(--red)', fontFamily: 'var(--font-num)' }}>
                      {result.attack_count}
                    </div>
                  </div>
                  <div className="result-meta-item">
                    <div className="result-meta-label">Total Flows</div>
                    <div className="result-meta-value" style={{ fontFamily: 'var(--font-num)' }}>
                      {result.total_predictions}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="result-meta-item" style={{ marginBottom: 10 }}>
                    <div className="result-meta-label">Attack Probability</div>
                    <div className="result-meta-value" style={{ color: 'var(--red)', fontFamily: 'var(--font-num)', fontSize: '1.3rem' }}>
                      {(attackProb * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="result-meta-item">
                    <div className="result-meta-label">Benign Probability</div>
                    <div className="result-meta-value" style={{ color: 'var(--green)', fontFamily: 'var(--font-num)', fontSize: '1.1rem' }}>
                      {(normalProb * 100).toFixed(2)}%
                    </div>
                  </div>
                  {riskMeta && (
                    <div style={{ marginTop: 12, fontSize: '.72rem', color: 'var(--text-muted)' }}>
                      Model-based Risk Level
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Binary limitation notice */}
          <div className="binary-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Binary classifier:</strong>{' '}
              {result.prediction === 'ATTACK' || (isBatch && result.attack_count > 0)
                ? 'Attack detected. Exact attack type is not classified — models are trained strictly for BENIGN vs ATTACK binary detection.'
                : 'All network flows fall within benign baseline parameters. No malicious behavioral signature detected.'}
            </span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SESSION SUMMARY (compact)
          ══════════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Session Summary
            </div>
            <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
              Current session statistics
            </span>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={resetSession}
            style={{ fontSize: '.75rem', padding: '4px 10px' }}
          >
            Clear Session
          </button>
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
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
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

      {/* ══════════════════════════════════════════════════════
          TRAFFIC DISTRIBUTION (compact donut)
          ══════════════════════════════════════════════════════ */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
              Traffic Distribution
            </div>
          </div>
          <div className="chart-wrap donut" style={{ height: 200 }}>
            <Doughnut data={donutData} options={donutOpts} />
            {totalAnalyzed > 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '36%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontFamily: 'var(--font-num)', fontSize: '1.4rem', fontWeight: 800 }}>{totalAnalyzed}</div>
                <div style={{ fontSize: '.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Total</div>
              </div>
            )}
          </div>
        </div>

        {/* ── RECENT ALERTS ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Recent Alerts
            </div>
          </div>

          <div className="alert-feed">
            {recentAlerts.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="30" height="30">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <p>No alerts yet. Run an analysis to see results here.</p>
              </div>
            ) : (
              recentAlerts.slice(0, 5).map((a, idx) => {
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
              })
            )}
          </div>

          {recentAlerts.length > 0 && (
            <button
              type="button"
              className="view-all-link"
              onClick={() => navigate('/overview')}
            >
              View All Alerts →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
