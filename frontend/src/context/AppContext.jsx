import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Session prediction records — truth source for all session statistics
  const [sessionPredictions, setSessionPredictions] = useState([]);
  
  // Local state for batch prediction arrays (if used by components like DetectionAnalytics)
  const [batchPredictions, setBatchPredictions] = useState([]);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Derive dashboard stats exclusively from actual prediction records
  const dashboardStats = useMemo(() => {
    let totalAnalyzed = 0;
    let attackCount = 0;
    let normalCount = 0;

    sessionPredictions.forEach(record => {
      const flows = record.flows_analyzed || 1;
      const attacks = record.attacks_detected ?? (record.prediction === 'ATTACK' ? flows : 0);
      const benign = record.benign_detected ?? (record.prediction === 'BENIGN' ? flows : 0);

      totalAnalyzed += flows;
      attackCount += attacks;
      normalCount += benign;
    });

    const detectionRate = totalAnalyzed > 0 ? (attackCount / totalAnalyzed) * 100 : 0;
    // Filter out only attacks for the alert feed
    const recentAlerts = sessionPredictions.filter(p => p.prediction === 'ATTACK');

    return {
      total_analyzed: totalAnalyzed,
      normal_count: normalCount,
      attack_count: attackCount,
      detection_rate: detectionRate,
      recent_alerts: recentAlerts,
    };
  }, [sessionPredictions]);

  // Derive model activity counts
  const modelActivity = useMemo(() => {
    const activity = { DNN: 0, LSTM: 0, GRU: 0 };
    sessionPredictions.forEach(record => {
      if (record.model) {
        activity[record.model] = (activity[record.model] || 0) + 1;
      }
    });
    return activity;
  }, [sessionPredictions]);

  /**
   * Add a prediction record to the session log.
   * @param {{model, prediction, attack_probability, risk_level, flows_analyzed, attacks_detected, benign_detected, input_type}} record
   */
  const addPredictionRecord = useCallback((record) => {
    setSessionPredictions((prev) => [record, ...prev].slice(0, 500));
  }, []);

  const resetSession = useCallback(() => {
    setSessionPredictions([]);
    setBatchPredictions([]);
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <AppContext.Provider
      value={{
        dashboardStats,
        sessionPredictions,
        batchPredictions,
        setBatchPredictions,
        modelActivity,
        addPredictionRecord,
        resetSession,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
