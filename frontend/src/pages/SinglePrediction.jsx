import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FEATURE_GROUPS, ALL_FEATURES, SAMPLE_DATA } from '../constants/features';
import { predictDNN, predictLSTM, predictGRU, predictCompare, predictCSV } from '../services/api';
import { getRiskLevelFromProbability } from '../constants/riskConfig';

export default function SinglePrediction() {
  const { selectedModel, showToast, addPredictionRecord } = useApp();
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' | 'csv'
  const isSequenceModel = selectedModel === 'LSTM' || selectedModel === 'GRU';

  // Manual flow data: for DNN we use flowData[0], for LSTM/GRU 10 flows
  const [activeFlowTab, setActiveFlowTab] = useState(0);
  const [flows, setFlows] = useState(() =>
    Array.from({ length: 10 }, () => {
      const obj = {};
      ALL_FEATURES.forEach((feat) => {
        obj[feat] = 0;
      });
      return obj;
    })
  );

  // CSV file state
  const [csvFile, setCsvFile] = useState(null);

  // Prediction status & results
  const [loading, setLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [comparisonResults, setComparisonResults] = useState(null);

  // Handle manual input change
  const handleFeatureChange = (feature, value) => {
    const num = parseFloat(value) || 0;
    setFlows((prev) => {
      const next = [...prev];
      next[activeFlowTab] = {
        ...next[activeFlowTab],
        [feature]: num,
      };
      return next;
    });
  };

  const handleLoadSample = () => {
    setFlows((prev) => {
      return prev.map(() => ({ ...SAMPLE_DATA }));
    });
    showToast('Loaded realistic sample network flow data', 'info');
  };

  const handleClear = () => {
    setFlows(
      Array.from({ length: 10 }, () => {
        const obj = {};
        ALL_FEATURES.forEach((feat) => {
          obj[feat] = 0;
        });
        return obj;
      })
    );
    setPredictionResult(null);
    setComparisonResults(null);
    setCsvFile(null);
    showToast('Form cleared', 'info');
  };

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setPredictionResult(null);
    setComparisonResults(null);

    try {
      if (inputMethod === 'csv') {
        if (!csvFile) {
          showToast('Please select a CSV file first', 'error');
          setLoading(false);
          return;
        }
        const res = await predictCSV(csvFile, selectedModel);
        // If CSV has predictions, take the first prediction or summary as result display
        if (res.predictions && res.predictions.length > 0) {
          const first = res.predictions[0];
          setPredictionResult({
            model: res.model,
            prediction: first.prediction,
            attack_probability: first.attack_probability,
            normal_probability: first.normal_probability,
            batchSummary: `Predicted ${res.total_predictions} flows (${res.attack_count} attacks, ${res.normal_count} normal)`,
          });
        }
        // Update stats
        addPredictionRecord({
          model: selectedModel,
          prediction: res.attack_count > 0 ? 'ATTACK' : 'BENIGN',
          attack_probability: res.attack_percentage / 100,
          risk_level: res.attack_count > 0 ? 'HIGH' : 'LOW',
          flows_analyzed: res.total_predictions,
          attacks_detected: res.attack_count,
          benign_detected: res.normal_count,
          input_type: 'csv',
        });
        showToast(`Batch predicted ${res.total_predictions} items successfully!`, 'success');
      } else {
        // Manual input
        let res;
        if (selectedModel === 'DNN') {
          const featureList = ALL_FEATURES.map((f) => flows[0][f] ?? 0);
          res = await predictDNN(featureList);
        } else if (selectedModel === 'LSTM') {
          const sequenceList = flows.map((flow) => ALL_FEATURES.map((f) => flow[f] ?? 0));
          res = await predictLSTM(sequenceList);
        } else if (selectedModel === 'GRU') {
          const sequenceList = flows.map((flow) => ALL_FEATURES.map((f) => flow[f] ?? 0));
          res = await predictGRU(sequenceList);
        }

        setPredictionResult(res);

        // Update dashboard session stats
        addPredictionRecord({
          model: res.model || selectedModel,
          prediction: res.prediction,
          attack_probability: res.attack_probability,
          risk_level: res.risk_level || getRiskLevelFromProbability(res.attack_probability).label,
          flows_analyzed: res.flows_analyzed ?? (isSequenceModel ? 10 : 1),
          attacks_detected: res.attacks_detected ?? (res.prediction === 'ATTACK' ? (isSequenceModel ? 10 : 1) : 0),
          benign_detected: res.benign_detected ?? (res.prediction === 'BENIGN' ? (isSequenceModel ? 10 : 1) : 0),
          input_type: 'manual',
        });

        showToast(`Result: ${res.prediction} (${(res.attack_probability * 100).toFixed(1)}%)`, res.prediction === 'ATTACK' ? 'error' : 'success');
      }
    } catch (err) {
      showToast(err.message || 'Prediction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareAll = async () => {
    setLoading(true);
    setComparisonResults(null);
    try {
      const sequenceList = flows.map((flow) => ALL_FEATURES.map((f) => flow[f] ?? 0));
      const res = await predictCompare(sequenceList);
      setComparisonResults(res);
      showToast('Ran comparison through DNN, LSTM, and GRU', 'success');
    } catch (err) {
      showToast(err.message || 'Model comparison failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="page-title">Single Prediction</h2>
          <p className="page-subtitle">Analyze real network flow traffic using {selectedModel} model</p>
        </div>

        {/* Input Method Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Input Method
          </span>
          <div className="segmented">
            <button
              type="button"
              className={`seg-btn ${inputMethod === 'manual' ? 'active' : ''}`}
              onClick={() => setInputMethod('manual')}
            >
              Manual Input
            </button>
            <button
              type="button"
              className={`seg-btn ${inputMethod === 'csv' ? 'active' : ''}`}
              onClick={() => setInputMethod('csv')}
            >
              Upload CSV
            </button>
          </div>
        </div>
      </div>

      {/* Model context banner */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ color: 'var(--accent)', display: 'flex' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          Active Model: <strong style={{ color: 'var(--text-primary)' }}>{selectedModel}</strong>.
          {isSequenceModel
            ? ' This sequential model processes a sequence of 10 consecutive network flows (Input shape: 1, 10, 78).'
            : ' This feedforward model processes 1 individual network flow with 78 features (Input shape: 1, 78).'}
        </div>
      </div>

      {/* Main Grid: Form / CSV on Left (2 cols), Result Card on Right (1 col) */}
      <div className="grid-row grid-3-col">
        {/* Left 2 Cols: Form or CSV Upload */}
        <div style={{ gridColumn: 'span 2' }}>
          {inputMethod === 'manual' ? (
            <div className="card">
              {/* Sequence flow selector tabs if LSTM / GRU */}
              {isSequenceModel && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                    SELECT FLOW TO CONFIGURE (10 CONSECUTIVE FLOWS REQUIRED):
                  </div>
                  <div className="flow-tabs">
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`flow-tab ${activeFlowTab === idx ? 'active' : ''}`}
                        onClick={() => setActiveFlowTab(idx)}
                      >
                        Flow {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handlePredict}>
                {FEATURE_GROUPS.map((group) => (
                  <div key={group.title} className="form-section">
                    <div className="form-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      {group.title}
                    </div>
                    <div className="form-grid">
                      {group.features.map((feat) => (
                        <div key={feat} className="form-group">
                          <label title={feat}>{feat}</label>
                          <input
                            type="number"
                            step="any"
                            value={flows[activeFlowTab][feat] ?? 0}
                            onChange={(e) => handleFeatureChange(feat, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner" /> Processing...
                      </>
                    ) : (
                      'Predict'
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    onClick={handleCompareAll}
                    disabled={loading}
                    title="Run the 10 flows through DNN, LSTM, and GRU"
                  >
                    Compare All Models
                  </button>

                  <button type="button" className="btn btn-secondary" onClick={handleLoadSample}>
                    Load Sample Data
                  </button>

                  <button type="button" className="btn btn-secondary" onClick={handleClear}>
                    Clear
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* CSV Upload Mode */
            <div className="card">
              <div className="card-header">
                <div className="card-title">Upload CIC-IDS-2017 CSV File</div>
              </div>
              <div
                className="upload-zone"
                onClick={() => document.getElementById('csv-file-input').click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setCsvFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCsvFile(e.target.files[0]);
                    }
                  }}
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48" style={{ color: 'var(--accent)', opacity: 0.8 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <h3>{csvFile ? csvFile.name : 'Click or Drag & Drop CSV file here'}</h3>
                <p>Supports CIC-IDS-2017 formatted flows with 78 numerical features (Label column stripped automatically)</p>
              </div>

              {csvFile && (
                <div className="file-info">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{csvFile.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {(csvFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => setCsvFile(null)}>
                    Remove
                  </button>
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={!csvFile || loading}
                  onClick={handlePredict}
                >
                  {loading ? (
                    <>
                      <span className="spinner" /> Analyzing CSV with {selectedModel}...
                    </>
                  ) : (
                    `Predict with ${selectedModel}`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Prediction Result Card (matches reference UI!) */}
        <div>
          <div className="card result-card" style={{ minHeight: 380 }}>
            <div className="card-header" style={{ justifyContent: 'center' }}>
              <div className="card-title">Prediction Result</div>
            </div>

            {predictionResult ? (
              <div>
                <div className={`result-icon ${predictionResult.prediction === 'ATTACK' ? 'attack' : 'benign'}`}>
                  {predictionResult.prediction === 'ATTACK' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                </div>

                <div className={`result-verdict ${predictionResult.prediction === 'ATTACK' ? 'attack' : 'benign'}`}>
                  {predictionResult.prediction === 'ATTACK' ? 'ATTACK DETECTED' : 'NORMAL TRAFFIC'}
                </div>

                <div style={{ marginTop: 8, marginBottom: 12 }}>
                  <span className={`risk-level-badge risk-badge-${(predictionResult.risk_level || getRiskLevelFromProbability(predictionResult.attack_probability).label).toLowerCase()}`}>
                    Model-based Risk: {predictionResult.risk_level || getRiskLevelFromProbability(predictionResult.attack_probability).label}
                  </span>
                </div>

                <div className="result-prob-label">Model Confidence (Attack)</div>
                <div className={`result-prob ${predictionResult.prediction === 'ATTACK' ? 'attack' : 'benign'}`}>
                  {(predictionResult.attack_probability * 100).toFixed(2)}%
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="prob-labels">
                    <span className="normal">Normal: {(predictionResult.normal_probability * 100).toFixed(1)}%</span>
                    <span className="attack">Attack: {(predictionResult.attack_probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="prob-bar">
                    <div
                      className="prob-bar-fill"
                      style={{ width: `${(predictionResult.attack_probability * 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 14, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6, lineHeight: 1.4 }}>
                  {predictionResult.attack_type_note ||
                    (predictionResult.prediction === 'ATTACK'
                      ? 'Attack detected — exact attack type not classified by current binary model'
                      : 'Normal network traffic (Benign)')}
                </div>

                {predictionResult.batchSummary && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
                    {predictionResult.batchSummary}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
                <h3>No Prediction Yet</h3>
                <p>Fill out the form or upload a CSV file, then click Predict.</p>
              </div>
            )}

            {/* Model Comparison breakdown (like shown in reference image) */}
            {comparisonResults && (
              <div className="model-results">
                <h4>Model Results</h4>
                {['dnn', 'lstm', 'gru'].map((mKey) => {
                  const m = comparisonResults[mKey];
                  if (!m) return null;
                  const prob = (m.attack_probability * 100).toFixed(2);
                  return (
                    <div key={mKey} className="model-result-row">
                      <div className="model-result-name">{m.model}</div>
                      <div className="model-result-bar">
                        <div
                          className={`model-result-bar-fill ${mKey}`}
                          style={{ width: `${prob}%` }}
                        />
                      </div>
                      <div className="model-result-val">{prob}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
