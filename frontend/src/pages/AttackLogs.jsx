import { useEffect, useState } from 'react';
import { getAttackLogs, clearAttackLogs } from '../services/api';
import { useApp } from '../context/AppContext';

export default function AttackLogs() {
  const { showToast } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterModel, setFilterModel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAttackLogs(300);
      setLogs(data.logs || []);
    } catch (err) {
      showToast('Failed to fetch attack logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all attack logs?')) return;
    try {
      await clearAttackLogs();
      setLogs([]);
      showToast('All attack logs cleared', 'info');
    } catch (err) {
      showToast('Failed to clear attack logs', 'error');
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('No logs to export', 'error');
      return;
    }
    const headers = ['ID', 'Timestamp', 'Model', 'Prediction', 'Attack Probability', 'Input Type', 'Record Index'];
    const rows = logs.map((l) => [
      l.id,
      `"${l.timestamp}"`,
      l.model,
      l.prediction,
      (l.attack_probability * 100).toFixed(2) + '%',
      l.input_type,
      l.record_index ?? 'N/A',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nids_attack_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported attack logs to CSV', 'success');
  };

  const filteredLogs = logs.filter((log) => {
    if (filterModel !== 'ALL' && log.model !== filterModel) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.timestamp.toLowerCase().includes(term) ||
        log.model.toLowerCase().includes(term) ||
        log.input_type.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="page-title">Attack Logs & Alerts</h2>
          <p className="page-subtitle">Real-time repository of detected network intrusions</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            Export to CSV
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleClear}>
            Clear Logs
          </button>
        </div>
      </div>

      <div className="card">
        {/* Filter bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>FILTER MODEL:</span>
            {['ALL', 'DNN', 'LSTM', 'GRU'].map((m) => (
              <button
                key={m}
                type="button"
                className={`btn btn-sm ${filterModel === m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterModel(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search logs by timestamp or input..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              minWidth: 260,
            }}
          />
        </div>

        {/* Table */}
        <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th># Alert ID</th>
                <th>Detection Timestamp</th>
                <th>Model</th>
                <th>Verdict</th>
                <th>Malicious Confidence</th>
                <th>Input Method</th>
                <th>Record Index</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading logs...' : 'No attack alerts found in this session.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>#{log.id}</td>
                    <td>{log.timestamp}</td>
                    <td>
                      <span className="badge badge-blue">{log.model}</span>
                    </td>
                    <td>
                      <span className="badge badge-red">ATTACK</span>
                    </td>
                    <td style={{ color: 'var(--red)', fontWeight: 600 }}>
                      {(log.attack_probability * 100).toFixed(2)}%
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{log.input_type}</span>
                    </td>
                    <td>{log.record_index !== null && log.record_index !== undefined ? log.record_index : 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Total entries recorded: {filteredLogs.length}
        </div>
      </div>
    </div>
  );
}
