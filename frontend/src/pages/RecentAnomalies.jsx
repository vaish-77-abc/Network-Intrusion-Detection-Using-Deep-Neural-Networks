import { useEffect, useState } from 'react';
import { getAttackLogs, clearAttackLogs } from '../services/api';
import { useApp } from '../context/AppContext';
import { getRiskLevelFromProbability } from '../constants/riskConfig';

export default function RecentAnomalies() {
  const { showToast } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterModel, setFilterModel] = useState('ALL');
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAttackLogs(500);
      setLogs(data.logs || []);
    } catch {
      showToast('Failed to fetch recent anomalies', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Clear all logged intrusion anomaly records?')) return;
    try {
      await clearAttackLogs();
      setLogs([]);
      showToast('All anomaly records cleared', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to clear anomaly records', 'error');
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('No anomaly records to export', 'error');
      return;
    }
    const headers = [
      'Record ID',
      'Timestamp',
      'Model Used',
      'Prediction',
      'Classification Scope',
      'Attack Probability',
      'Risk Level',
      'Input Source',
      'Flow Sequence Index',
    ];
    const rows = logs.map((l) => {
      const rLevel =
        l.risk_level || getRiskLevelFromProbability(l.attack_probability).label;
      return [
        l.id,
        `"${l.timestamp}"`,
        l.model,
        l.prediction,
        '"Attack Detected — Type Not Classified (Binary Model)"',
        (l.attack_probability * 100).toFixed(2) + '%',
        rLevel,
        l.input_type,
        l.record_index !== null && l.record_index !== undefined ? l.record_index + 1 : 'Single',
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `nids_recent_anomalies_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported anomaly records to CSV', 'success');
  };

  // Filter logs: focus strictly on ATTACK anomalies
  const attackAnomalies = logs.filter((log) => log.prediction === 'ATTACK');

  const filtered = attackAnomalies.filter((log) => {
    if (filterModel !== 'ALL' && log.model !== filterModel) return false;
    const rLevel =
      log.risk_level || getRiskLevelFromProbability(log.attack_probability).label;
    if (filterRisk !== 'ALL' && rLevel !== filterRisk) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.timestamp.toLowerCase().includes(term) ||
        log.model.toLowerCase().includes(term) ||
        String(log.id).includes(term) ||
        String(log.record_index).includes(term)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Critical anomaly count
  const criticalCount = attackAnomalies.filter(
    (a) =>
      (a.risk_level === 'CRITICAL') ||
      (!a.risk_level && a.attack_probability >= 0.85)
  ).length;

  return (
    <div className="anomalies-page">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h2 className="page-title">Recent Network Anomalies & Intrusions</h2>
          <p className="page-subtitle">
            Catalog of malicious traffic flows identified by binary deep neural classifiers
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Anomalies (CSV)
          </button>
          <button
            className="btn btn-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
            onClick={handleClear}
          >
            Clear Records
          </button>
        </div>
      </div>

      {/* ─── Anomaly Metric Snapshot ─────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div className="stat-card-icon red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div className="stat-card-label">Total Anomalies Detected</div>
            <div className="stat-card-value font-mono" style={{ color: 'var(--red)' }}>
              {attackAnomalies.length.toLocaleString()}
            </div>
            <div className="stat-card-sub">Binary attack classification</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="stat-card-icon red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <div className="stat-card-label">Critical Threat Level</div>
            <div className="stat-card-value font-mono" style={{ color: '#ef4444' }}>
              {criticalCount.toLocaleString()}
            </div>
            <div className="stat-card-sub">Confidence &ge; 85%</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="stat-card-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <div className="stat-card-label">Active Filter Matches</div>
            <div className="stat-card-value font-mono">{filtered.length.toLocaleString()}</div>
            <div className="stat-card-sub">Matching current criteria</div>
          </div>
        </div>
      </div>

      {/* ─── Classification Notice ───────────────────────────────── */}
      <div className="binary-clarification-callout" style={{ marginBottom: 20 }}>
        <div className="binary-callout-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="binary-callout-text">
          <h4>Classification Integrity Standard</h4>
          <p>
            The trained models in this system operate as strict binary classifiers (<code>BENIGN</code> vs{' '}
            <code>ATTACK</code>). Records on this page reflect confirmed deviations from benign baseline
            traffic. Specific sub-attack categories (DDoS, Botnet, PortScan) are not classified by this binary
            pipeline.
          </p>
        </div>
      </div>

      {/* ─── Control Bar: Filters & Search ───────────────────────── */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Model:</span>
            <select
              className="select-field"
              style={{ padding: '6px 10px', fontSize: '.8rem' }}
              value={filterModel}
              onChange={(e) => {
                setFilterModel(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Models</option>
              <option value="DNN">DNN (MLP)</option>
              <option value="LSTM">LSTM Recurrent</option>
              <option value="GRU">GRU Recurrent</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Risk:</span>
            <select
              className="select-field"
              style={{ padding: '6px 10px', fontSize: '.8rem' }}
              value={filterRisk}
              onChange={(e) => {
                setFilterRisk(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical (85–100%)</option>
              <option value="HIGH">High (60–85%)</option>
              <option value="MEDIUM">Medium (30–60%)</option>
              <option value="LOW">Low (0–30%)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', padding: 3, borderRadius: 6 }}>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '.72rem' }}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '.72rem' }}
              onClick={() => setViewMode('cards')}
            >
              Cards
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by ID, index, timestamp..."
          className="input-field"
          style={{ width: 250, padding: '6px 12px', fontSize: '.8rem' }}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ─── Main Content View (Table or Cards) ──────────────────── */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>Loading anomaly telemetry...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state" style={{ padding: '60px 20px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="44" height="44">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h3>No Anomalies Matched</h3>
          <p>
            {attackAnomalies.length === 0
              ? 'No malicious intrusion events have been detected in the current session.'
              : 'No anomalies match your active filter and search terms.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Record #</th>
                  <th>Timestamp</th>
                  <th>Model</th>
                  <th>Prediction</th>
                  <th>Classification Scope</th>
                  <th>Attack Confidence</th>
                  <th>Model-based Risk</th>
                  <th>Input Source</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log) => {
                  const rLevel =
                    log.risk_level || getRiskLevelFromProbability(log.attack_probability).label;
                  return (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        #{log.id}
                        {log.record_index !== null && log.record_index !== undefined && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '.75rem', marginLeft: 4 }}>
                            (Flow #{log.record_index + 1})
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.8rem', fontFamily: 'monospace' }}>
                        {log.timestamp}
                      </td>
                      <td>
                        <span className="badge badge-primary font-mono">{log.model}</span>
                      </td>
                      <td>
                        <span className="badge badge-danger">ATTACK DETECTED</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '.78rem' }}>
                        Attack Detected — Type Not Classified
                      </td>
                      <td style={{ color: 'var(--red)', fontWeight: 800, fontFamily: 'monospace' }}>
                        {(log.attack_probability * 100).toFixed(2)}%
                      </td>
                      <td>
                        <span className={`risk-level-badge risk-badge-${rLevel.toLowerCase()}`} style={{ fontSize: '.7rem', padding: '3px 8px' }}>
                          {rLevel}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                        {log.input_type}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} anomalies
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Card View */
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
              marginBottom: 18,
            }}
          >
            {paginated.map((log) => {
              const rLevel =
                log.risk_level || getRiskLevelFromProbability(log.attack_probability).label;
              return (
                <div
                  key={log.id}
                  className="card"
                  style={{
                    borderLeft: '4px solid var(--red)',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '.9rem' }}>
                        Anomaly Record #{log.id}
                      </span>
                      <span className={`risk-level-badge risk-badge-${rLevel.toLowerCase()}`} style={{ fontSize: '.68rem', padding: '2px 8px' }}>
                        {rLevel}
                      </span>
                    </div>

                    <div style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
                      Attack Detected — Type Not Classified
                    </div>

                    <div style={{ fontSize: '.76rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                      Model: <strong>{log.model}</strong> • Source: {log.input_type}
                      {log.record_index !== null && log.record_index !== undefined && ` • Flow Index: #${log.record_index + 1}`}
                    </div>
                  </div>

                  <div
                    style={{
                      paddingTop: 10,
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {log.timestamp}
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--red)', fontFamily: 'monospace' }}>
                      {(log.attack_probability * 100).toFixed(1)}% Confidence
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
              <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', fontSize: '.78rem', color: 'var(--text-muted)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
