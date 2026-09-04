/**
 * Centralized Model-based Risk Level Configuration
 *
 * NOTE: This is labeled as "Model-based Risk Level" derived from
 * deep learning classification probability (0.0 to 1.0),
 * not an externally certified security score.
 */

export const RISK_THRESHOLDS = {
  LOW: {
    maxProb: 0.30,
    label: 'LOW',
    severity: 'Low',
    color: '#22c55e',
    dimColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    description: 'Traffic characteristics consistent with baseline benign operations.',
  },
  MEDIUM: {
    maxProb: 0.60,
    label: 'MEDIUM',
    severity: 'Moderate',
    color: '#f59e0b',
    dimColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    description: 'Elevated variance or uncommon packet rates warranting monitoring.',
  },
  HIGH: {
    maxProb: 0.85,
    label: 'HIGH',
    severity: 'High',
    color: '#f97316',
    dimColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
    description: 'High confidence anomalous pattern matching known intrusion traits.',
  },
  CRITICAL: {
    maxProb: 1.00,
    label: 'CRITICAL',
    severity: 'Critical',
    color: '#ef4444',
    dimColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    description: 'Critical threshold breach indicating malicious network intrusion.',
  },
};

export function getRiskLevelFromProbability(prob) {
  const p = Number(prob) || 0;
  if (p < 0.30) return RISK_THRESHOLDS.LOW;
  if (p < 0.60) return RISK_THRESHOLDS.MEDIUM;
  if (p < 0.85) return RISK_THRESHOLDS.HIGH;
  return RISK_THRESHOLDS.CRITICAL;
}

export function getSeverityLabel(prob) {
  const p = Number(prob) || 0;
  if (p < 0.15) return 'Informational';
  if (p < 0.30) return 'Low';
  if (p < 0.60) return 'Moderate';
  if (p < 0.85) return 'High';
  return 'Critical';
}
