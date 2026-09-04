import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { predictCSV } from '../services/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { getRiskLevelFromProbability } from '../constants/riskConfig';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function BatchPrediction() {
  const { selectedModel, showToast, addPredictionRecord, setBatchPredictions } = useApp();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndPredict = async () => {
    if (!file) {
      showToast('Please select a CSV file', 'error');
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const res = await predictCSV(file, selectedModel);
      setResult(res);
      setBatchPredictions(res.predictions || []);

      // Update cumulative stats
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

      showToast(`Analyzed ${res.total_predictions} samples with ${res.model}`, 'success');
    } catch (err) {
      showToast(err.message || 'Batch prediction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredPredictions = result?.predictions
    ? result.predictions.filter((p) =>
        searchFilter === ''
          ? true
          : p.prediction.toLowerCase().includes(searchFilter.toLowerCase()) ||
            p.index.toString().includes(searchFilter)
      )
    : [];

  const donutData = result
    ? {
        labels: ['Normal', 'Attack'],
        datasets: [
          {
            data: [result.normal_count, result.attack_count],
            backgroundColor: ['#22c55e', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      }
    : null;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Batch Prediction (CSV)</h2>
        <p className="page-subtitle">
          Upload and process network flow dataset files using {selectedModel}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div
          className="upload-zone"
          onClick={() => document.getElementById('batch-file-input').click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              setFile(e.dataTransfer.files[0]);
            }
          }}
        >
          <input
            id="batch-file-input"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48" style={{ color: 'var(--accent)', opacity: 0.8 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <h3>{file ? file.name : 'Select or Drag CIC-IDS-2017 CSV File'}</h3>
          <p>
            {selectedModel === 'DNN'
              ? 'DNN predicts each network flow independently.'
              : `${selectedModel} automatically groups consecutive flows into 10-flow sequences.`}
          </p>
        </div>

        {file && (
          <div className="file-info">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{file.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => setFile(null)}>
              Remove
            </button>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!file || loading}
            onClick={handleUploadAndPredict}
          >
            {loading ? (
              <>
                <span className="spinner" /> Analyzing with {selectedModel}...
              </>
            ) : (
              `Run Batch Analysis (${selectedModel})`
            )}
          </button>
        </div>
      </div>

      {result && (
        <>
          {/* Summary Stat Cards */}
          <div className="batch-summary">
            <div className="batch-item">
              <div className="batch-value" style={{ color: 'var(--accent)' }}>
                {result.total_records.toLocaleString()}
              </div>
              <div className="batch-label">Total Flows</div>
            </div>
            <div className="batch-item">
              <div className="batch-value">{result.total_predictions.toLocaleString()}</div>
              <div className="batch-label">Predictions Made</div>
            </div>
            <div className="batch-item">
              <div className="batch-value" style={{ color: 'var(--green)' }}>
                {result.normal_count.toLocaleString()} ({result.normal_percentage}%)
              </div>
              <div className="batch-label">Normal Traffic</div>
            </div>
            <div className="batch-item">
              <div className="batch-value" style={{ color: 'var(--red)' }}>
                {result.attack_count.toLocaleString()} ({result.attack_percentage}%)
              </div>
              <div className="batch-label">Attacks Detected</div>
            </div>
          </div>

          <div className="grid-row grid-2-col">
            {/* Donut Distribution */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Classification Ratio</div>
              </div>
              <div className="chart-wrap donut">
                {donutData && <Doughnut data={donutData} options={{ maintainAspectRatio: false }} />}
              </div>
            </div>

            {/* Model Info */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Batch Summary</div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <strong>Model:</strong> {result.model}
                <br />
                <strong>Processing Mode:</strong>{' '}
                {result.model === 'DNN' ? 'Single-Flow Feedforward (78,)' : 'Sequential Recurrent (10, 78)'}
                <br />
                <strong>Detection Rate:</strong> {result.attack_percentage}%
                <br />
                <strong>Flows / Sequences:</strong> {result.total_predictions} evaluated
              </p>
            </div>
          </div>

          {/* Predictions Table */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div className="card-title">Detailed Classification Logs</div>
              <input
                type="text"
                placeholder="Filter by Index or Verdict..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            {/* Binary Classifier Limitation Notice */}
            <div className="binary-clarification-callout" style={{ margin: '14px 16px 0' }}>
              <div className="binary-callout-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div className="binary-callout-text">
                <h4>Binary Model Classification Notice</h4>
                <p>
                  Current deep learning models are strictly binary classifiers (<code>BENIGN</code> vs <code>ATTACK</code>).
                  If the dataset contains a known <code>Label</code> column, it is displayed under &ldquo;Dataset Label&rdquo; for reference,
                  and is never presented as the model&rsquo;s predicted attack sub-type.
                </p>
              </div>
            </div>

            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th># Index</th>
                    <th>Prediction</th>
                    <th>Model Confidence (Attack)</th>
                    <th>Normal Probability</th>
                    <th>Model-based Risk</th>
                    <th>Dataset Label</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.slice(0, 200).map((pred) => {
                    const isAttack = pred.prediction === 'ATTACK';
                    const flowRisk = pred.risk_level || getRiskLevelFromProbability(pred.attack_probability).label;
                    return (
                      <tr key={pred.index}>
                        <td>#{pred.index + 1}</td>
                        <td>
                          <span className={`badge ${isAttack ? 'badge-danger' : 'badge-success'}`}>
                            {pred.prediction}
                          </span>
                        </td>
                        <td style={{ color: isAttack ? 'var(--red)' : 'var(--text-secondary)', fontWeight: 700 }}>
                          {(pred.attack_probability * 100).toFixed(2)}%
                        </td>
                        <td style={{ color: !isAttack ? 'var(--green)' : 'var(--text-secondary)' }}>
                          {(pred.normal_probability * 100).toFixed(2)}%
                        </td>
                        <td>
                          <span className={`risk-level-badge risk-badge-${flowRisk.toLowerCase()}`} style={{ fontSize: '.68rem', padding: '2px 8px' }}>
                            {flowRisk}
                          </span>
                        </td>
                        <td style={{ color: pred.dataset_label ? 'var(--cyan)' : 'var(--text-muted)', fontStyle: pred.dataset_label ? 'normal' : 'italic' }}>
                          {pred.dataset_label || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredPredictions.length > 150 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10 }}>
                Showing first 150 of {filteredPredictions.length} predictions.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
