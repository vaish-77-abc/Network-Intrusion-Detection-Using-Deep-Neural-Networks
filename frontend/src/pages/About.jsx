export default function About() {
  const pipelineSteps = [
    'Network Flow',
    'Preprocessing',
    'Feature Scaling (StandardScaler)',
    'Deep Learning Model',
    'Prediction (Sigmoid Output)',
    'Risk Assessment',
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
          SYSTEM DOCUMENTATION
        </div>
        <h2 className="page-title">About System</h2>
        <p className="page-subtitle">
          Network Intrusion Detection System using Deep Learning — Academic Reference
        </p>
      </div>

      <div className="about-grid">
        {/* ── Project Objective ── */}
        <div className="card about-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Project Objective
          </h3>
          <p>
            The <strong>Network Intrusion Detection System (NIDS)</strong> is an AI-powered platform designed to
            detect malicious network intrusions using deep learning models trained on real network traffic data.
            It provides binary classification between benign and attack traffic for real-time threat detection
            in enterprise network environments.
          </p>
        </div>

        {/* ── Dataset ── */}
        <div className="card about-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Dataset
          </h3>
          <p style={{ marginBottom: 10 }}>
            <strong>CIC-IDS-2017</strong> — Canadian Institute for Cybersecurity Intrusion Detection dataset.
            Captures realistic network traffic with various contemporary attack types.
          </p>
          <ul>
            <li><strong>78 Engineered Features:</strong> Flow duration, packet lengths, TCP flags, IAT, subflows, window sizes</li>
            <li><strong>Binary Target:</strong> BENIGN (0) vs. ATTACK (1)</li>
            <li><strong>Balanced Corpus:</strong> 200,000 benign + 200,000 attack flows (400,000 total)</li>
            <li><strong>Row Ordering Preserved:</strong> Consecutive rows represent temporal flow sequences</li>
          </ul>
        </div>

        {/* ── Input ── */}
        <div className="card about-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Input
          </h3>
          <p style={{ marginBottom: 10 }}>
            <strong>78 Network Flow Features</strong> derived from CICFlowMeter, capturing statistical properties of network sessions.
          </p>
          <ul>
            <li>Destination Port, Flow Duration</li>
            <li>Packet Counts (Fwd/Bwd)</li>
            <li>Packet Lengths (Max, Min, Mean, Std)</li>
            <li>Flow Bytes/s, Flow Packets/s</li>
            <li>Inter-Arrival Times (IAT)</li>
            <li>TCP Flags (FIN, SYN, RST, PSH, ACK, URG)</li>
            <li>Subflow & Window Features</li>
            <li>Active / Idle Time Statistics</li>
          </ul>
        </div>

        {/* ── Models ── */}
        <div className="card about-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Models
          </h3>
          <ul>
            <li>
              <strong style={{ color: 'var(--dnn-color)' }}>DNN (Deep Neural Network):</strong>{' '}
              Feedforward MLP — Input: (78,) — Single flow classification
            </li>
            <li>
              <strong style={{ color: 'var(--lstm-color)' }}>LSTM (Long Short-Term Memory):</strong>{' '}
              Recurrent architecture — Input: (10, 78) — Sequence of 10 flows
            </li>
            <li>
              <strong style={{ color: 'var(--gru-color)' }}>GRU (Gated Recurrent Unit):</strong>{' '}
              Efficient recurrent architecture — Input: (10, 78) — Sequence of 10 flows
            </li>
          </ul>
        </div>

        {/* ── Classification ── */}
        <div className="card about-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Classification
          </h3>
          <p style={{ marginBottom: 12 }}>
            All three models perform <strong>binary classification</strong>:
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, padding: '12px 16px', background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,.20)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--green)', fontSize: '1rem' }}>BENIGN</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Normal Network Traffic</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem' }}>vs</div>
            <div style={{ flex: 1, padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,.20)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--red)', fontSize: '1rem' }}>ATTACK</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Malicious Intrusion</div>
            </div>
          </div>
        </div>

        {/* ── System Pipeline ── */}
        <div className="card about-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 4 12 14.01 9 11.01" />
              <path d="M22 4l-10 10-4-4" />
            </svg>
            System Pipeline
          </h3>
          <div className="pipeline-steps">
            {pipelineSteps.map((step, idx) => (
              <div className="pipeline-step" key={step}>
                <div className="pipeline-step-icon">{idx + 1}</div>
                <div className="pipeline-step-text">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Important Limitation ── */}
      <div className="limitation-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <strong style={{ color: 'var(--amber)' }}>Important Limitation:</strong>{' '}
          The current models perform <strong>binary intrusion detection</strong> (Benign vs Attack).
          Exact attack-type classification (DDoS, Port Scan, Brute Force, Botnet, Web Attack, etc.) is not implemented.
          The models output a probability score between 0.0 and 1.0 from a sigmoid activation function.
          Predictions above 0.5 are classified as ATTACK.
        </div>
      </div>

      {/* ── Technology Stack ── */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div className="card-title">Technology Stack</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            'Python 3.10+', 'FastAPI', 'TensorFlow / Keras',
            'scikit-learn (StandardScaler)', 'NumPy / Pandas',
            'React 19', 'Vite 8', 'Chart.js',
            'CIC-IDS-2017 Dataset',
          ].map((t) => (
            <span key={t} className="tech-badge">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
