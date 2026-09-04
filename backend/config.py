"""
Centralized configuration for the NIDS backend.
Uses environment variables with sensible defaults.
"""

import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent

# Model directory
MODEL_DIR = Path(os.getenv("NIDS_MODEL_DIR", str(BASE_DIR / "models")))

# Model file paths
DNN_MODEL_PATH = MODEL_DIR / "dnn_intrusion_model.keras"
LSTM_MODEL_PATH = MODEL_DIR / "lstm_intrusion_model.keras"
GRU_MODEL_PATH = MODEL_DIR / "gru_intrusion_model.keras"

# Scaler file paths
DNN_SCALER_PATH = MODEL_DIR / "dnn_scaler.pkl"
LSTM_SCALER_PATH = MODEL_DIR / "lstm_scaler.pkl"
GRU_SCALER_PATH = MODEL_DIR / "gru_scaler.pkl"

# Feature columns
FEATURE_COLUMNS_PATH = MODEL_DIR / "feature_columns.json"

# Upload settings
MAX_UPLOAD_SIZE_MB = int(os.getenv("NIDS_MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".csv"}

# CORS
CORS_ORIGINS = os.getenv("NIDS_CORS_ORIGINS", "*").split(",")

# Sequence length for LSTM/GRU
SEQUENCE_LENGTH = 10

# Number of input features
NUM_FEATURES = 78

# Model performance metrics (from test set evaluation)
MODEL_METRICS = {
    "DNN": {
        "accuracy": 98.8725,
        "precision": 98.3283,
        "recall": 99.4365,
        "f1_score": 98.8793,
    },
    "LSTM": {
        "accuracy": 99.2556,
        "precision": 99.5417,
        "recall": 98.9688,
        "f1_score": 99.2544,
    },
    "GRU": {
        "accuracy": 99.0947,
        "precision": 99.5882,
        "recall": 98.5971,
        "f1_score": 99.0902,
    },
}

# Model-based Risk Thresholds (Probabilities: 0.0 - 1.0)
# Configurable single source of truth for Model-based Risk Level
RISK_THRESHOLDS = {
    "LOW": {"max_prob": 0.30, "label": "LOW", "severity": "Low"},
    "MEDIUM": {"max_prob": 0.60, "label": "MEDIUM", "severity": "Moderate"},
    "HIGH": {"max_prob": 0.85, "label": "HIGH", "severity": "High"},
    "CRITICAL": {"max_prob": 1.00, "label": "CRITICAL", "severity": "Critical"},
}

def get_risk_assessment(probability: float) -> dict:
    """
    Calculate Model-based Risk Level and Threat Severity from attack probability.
    Note: Labeled explicitly as 'Model-based Risk Level', not a security certification.
    """
    prob = float(probability)
    if prob < 0.30:
        severity = "Low" if prob >= 0.15 else "Informational"
        return {"risk_level": "LOW", "severity": severity}
    elif prob < 0.60:
        return {"risk_level": "MEDIUM", "severity": "Moderate"}
    elif prob < 0.85:
        return {"risk_level": "HIGH", "severity": "High"}
    else:
        return {"risk_level": "CRITICAL", "severity": "Critical"}

def get_attack_type_note(prediction: str) -> str:
    """
    Clarify that the model is a binary classifier (BENIGN vs ATTACK).
    Does NOT claim to identify exact attack subcategories.
    """
    if prediction == "ATTACK":
        return "Attack detected — exact attack type not classified by current binary model"
    return "Normal network traffic (Benign)"

