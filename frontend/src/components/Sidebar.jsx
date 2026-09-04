import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { healthCheck, getModelsInfo } from '../services/api';

export default function Sidebar() {
  const [apiOnline, setApiOnline] = useState(null); // null = checking
  const [modelCount, setModelCount] = useState(3);

  useEffect(() => {
    async function checkStatus() {
      try {
        const health = await healthCheck();
        setApiOnline(health.status === 'healthy' || health.models_loaded === true);
        const info = await getModelsInfo();
        setModelCount(info.models?.length ?? 3);
      } catch {
        setApiOnline(false);
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="sidebar">
      {/* ── Brand ── */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <h1>NID SYSTEM</h1>
            <span>Protecting Networks</span>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/overview" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Overview</span>
        </NavLink>

        <NavLink to="/model-comparison" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Model Comparison</span>
        </NavLink>

        <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>About System</span>
        </NavLink>
      </nav>

      {/* ── Status Footer ── */}
      <div className="sidebar-footer">
        <div className="sidebar-status-item">
          <div
            className={`sidebar-status-dot ${
              apiOnline === null ? 'offline' : apiOnline ? 'online' : 'offline'
            }`}
          />
          <span>
            {apiOnline === null ? 'CHECKING API...' : apiOnline ? 'API CONNECTED' : 'API OFFLINE'}
          </span>
        </div>
        <div className="sidebar-status-item">
          <div className={`sidebar-status-dot ${apiOnline ? 'online' : 'offline'}`} />
          <span>{apiOnline ? `${modelCount} MODELS READY` : 'MODELS NOT LOADED'}</span>
        </div>
      </div>
    </aside>
  );
}
