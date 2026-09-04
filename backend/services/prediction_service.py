"""
Prediction Service — orchestrates preprocessing and model inference.
"""

import logging
import numpy as np
from typing import List, Dict, Any, Optional

from services.model_service import model_service
from services.preprocessing import (
    validate_feature_values,
    scale_features_single,
    scale_features_batch,
    create_sequences,
)
from config import (
    NUM_FEATURES, SEQUENCE_LENGTH,
    get_risk_assessment, get_attack_type_note
)

logger = logging.getLogger(__name__)


def _make_result(model_name: str, prob: float, flows_analyzed: int = 1) -> Dict[str, Any]:
    """Build a prediction result dict from an actual model probability."""
    prediction = "ATTACK" if prob >= 0.5 else "BENIGN"
    risk_info = get_risk_assessment(prob)
    attack_cnt = 1 if prediction == "ATTACK" else 0
    benign_cnt = 1 if prediction == "BENIGN" else 0
    return {
        "model": model_name,
        "prediction": prediction,
        "attack_probability": round(prob, 6),
        "normal_probability": round(1.0 - prob, 6),
        "risk_level": risk_info["risk_level"],
        "severity": risk_info["severity"],
        "attack_type_note": get_attack_type_note(prediction),
        "flows_analyzed": flows_analyzed,
        "attacks_detected": attack_cnt,
        "benign_detected": benign_cnt,
    }


def predict_single_dnn(features: List[float]) -> Dict[str, Any]:
    """
    Predict a single network flow using the DNN model.
    features: list of 78 floats.
    """
    cleaned = validate_feature_values(features)
    arr = np.array(cleaned, dtype=np.float32).reshape(1, -1)

    scaler = model_service.get_scaler("DNN")
    scaled = scaler.transform(arr)

    prob = model_service.predict_dnn(scaled)
    return _make_result("DNN", prob, flows_analyzed=1)


def predict_sequence_lstm(sequences: List[List[float]]) -> Dict[str, Any]:
    """
    Predict using LSTM on a sequence of 10 flows.
    sequences: list of 10 lists, each containing 78 floats.
    """
    if len(sequences) != SEQUENCE_LENGTH:
        raise ValueError(f"LSTM requires exactly {SEQUENCE_LENGTH} flows, got {len(sequences)}.")

    cleaned = [validate_feature_values(flow) for flow in sequences]
    arr = np.array(cleaned, dtype=np.float32)  # (10, 78)

    scaler = model_service.get_scaler("LSTM")
    scaled = scaler.transform(arr)  # (10, 78)
    scaled = scaled.reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)  # (1, 10, 78)

    prob = model_service.predict_lstm(scaled)
    return _make_result("LSTM", prob, flows_analyzed=SEQUENCE_LENGTH)


def predict_sequence_gru(sequences: List[List[float]]) -> Dict[str, Any]:
    """
    Predict using GRU on a sequence of 10 flows.
    sequences: list of 10 lists, each containing 78 floats.
    """
    if len(sequences) != SEQUENCE_LENGTH:
        raise ValueError(f"GRU requires exactly {SEQUENCE_LENGTH} flows, got {len(sequences)}.")

    cleaned = [validate_feature_values(flow) for flow in sequences]
    arr = np.array(cleaned, dtype=np.float32)  # (10, 78)

    scaler = model_service.get_scaler("GRU")
    scaled = scaler.transform(arr)  # (10, 78)
    scaled = scaled.reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)  # (1, 10, 78)

    prob = model_service.predict_gru(scaled)
    return _make_result("GRU", prob, flows_analyzed=SEQUENCE_LENGTH)


def predict_csv_batch(
    data: np.ndarray,
    model_name: str,
    feature_columns: List[str],
    dataset_labels: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Run batch prediction on preprocessed CSV data.

    data: numpy array of shape (N, 78), already validated and column-ordered.
    model_name: "DNN", "LSTM", or "GRU".
    dataset_labels: optional original Label values from CSV (never used for inference).
    """
    model_name = model_name.upper()
    scaler = model_service.get_scaler(model_name)

    predictions = []

    if model_name == "DNN":
        # Scale all flows at once
        scaled = scaler.transform(data)
        model = model_service.get_model("DNN")
        probs = model.predict(scaled, verbose=0).flatten()

        for i, prob in enumerate(probs):
            prob_val = float(prob)
            risk_info = get_risk_assessment(prob_val)
            pred_status = "ATTACK" if prob_val >= 0.5 else "BENIGN"
            predictions.append({
                "index": i,
                "prediction": pred_status,
                "attack_probability": round(prob_val, 6),
                "normal_probability": round(1.0 - prob_val, 6),
                "risk_level": risk_info["risk_level"],
                "severity": risk_info["severity"],
                "dataset_label": dataset_labels[i] if dataset_labels and i < len(dataset_labels) else None,
            })

    else:
        # LSTM or GRU — create sequences
        scaled = scaler.transform(data)
        sequences = create_sequences(scaled, SEQUENCE_LENGTH)  # (num_seq, 10, 78)

        model = model_service.get_model(model_name)
        probs = model.predict(sequences, verbose=0).flatten()

        for i, prob in enumerate(probs):
            prob_val = float(prob)
            risk_info = get_risk_assessment(prob_val)
            pred_status = "ATTACK" if prob_val >= 0.5 else "BENIGN"
            # For sequence i, the sequence covers rows [i, i + SEQUENCE_LENGTH - 1]
            last_row_idx = i + SEQUENCE_LENGTH - 1
            lbl = dataset_labels[last_row_idx] if dataset_labels and last_row_idx < len(dataset_labels) else None
            predictions.append({
                "index": i,
                "prediction": pred_status,
                "attack_probability": round(prob_val, 6),
                "normal_probability": round(1.0 - prob_val, 6),
                "risk_level": risk_info["risk_level"],
                "severity": risk_info["severity"],
                "dataset_label": lbl,
            })

    normal_count = sum(1 for p in predictions if p["prediction"] == "BENIGN")
    attack_count = sum(1 for p in predictions if p["prediction"] == "ATTACK")
    total = len(predictions)

    attack_rate = (attack_count / total) if total > 0 else 0.0
    batch_risk = get_risk_assessment(attack_rate)
    attack_note = get_attack_type_note("ATTACK" if attack_count > 0 else "BENIGN")

    return {
        "model": model_name,
        "total_records": int(data.shape[0]),
        "total_predictions": total,
        "normal_count": normal_count,
        "attack_count": attack_count,
        "normal_percentage": round((normal_count / total) * 100, 2) if total > 0 else 0,
        "attack_percentage": round((attack_count / total) * 100, 2) if total > 0 else 0,
        "risk_level": batch_risk["risk_level"],
        "severity": batch_risk["severity"],
        "attack_type_note": attack_note,
        "predictions": predictions,
    }


def compare_all_models(sequences: List[List[float]]) -> Dict[str, Any]:
    """
    Run the same 10-flow sequence through all 3 models.
    DNN uses the last flow of the sequence.
    """
    if len(sequences) != SEQUENCE_LENGTH:
        raise ValueError(f"Comparison requires exactly {SEQUENCE_LENGTH} flows.")

    results = {}

    # DNN — use the last flow
    dnn_result = predict_single_dnn(sequences[-1])
    results["dnn"] = dnn_result

    # LSTM
    lstm_result = predict_sequence_lstm(sequences)
    results["lstm"] = lstm_result

    # GRU
    gru_result = predict_sequence_gru(sequences)
    results["gru"] = gru_result

    return results
