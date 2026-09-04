"""
API Routes — all REST endpoints for the NIDS application.
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Query, HTTPException

from schemas.prediction import (
    SingleFlowInput, SequenceFlowInput, PredictionResult,
    CSVPredictionResponse, ModelComparisonResponse, ModelMetrics,
    AttackLogEntry, DashboardStats, HealthResponse, ModelsInfoResponse,
    ErrorResponse, ModelName
)
from services.model_service import model_service
from services.prediction_service import (
    predict_single_dnn, predict_sequence_lstm, predict_sequence_gru,
    predict_csv_batch, compare_all_models
)
from services.preprocessing import (
    parse_csv_bytes, validate_csv_columns, clean_dataframe
)
from config import (
    MODEL_METRICS, MAX_UPLOAD_SIZE_BYTES, NUM_FEATURES, SEQUENCE_LENGTH,
    get_risk_assessment
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["NIDS API"])

# ─── In-Memory Session State ──────────────────────────────────────
# Stores attack logs and dashboard stats for the current session.

_attack_logs: List[dict] = []
_session_stats = {
    "total_analyzed": 0,
    "normal_count": 0,
    "attack_count": 0,
}
_log_counter = 0


def _add_attack_log(model: str, prediction: str, probability: float,
                    input_type: str, record_index: Optional[int] = None,
                    risk_level: Optional[str] = None, severity: Optional[str] = None):
    """Add an entry to the attack logs."""
    global _log_counter
    _log_counter += 1
    if not risk_level or not severity:
        r_info = get_risk_assessment(probability)
        risk_level = risk_level or r_info["risk_level"]
        severity = severity or r_info["severity"]
    entry = {
        "id": _log_counter,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "model": model,
        "prediction": prediction,
        "attack_probability": round(probability, 6),
        "input_type": input_type,
        "record_index": record_index,
        "risk_level": risk_level,
        "severity": severity,
    }
    _attack_logs.insert(0, entry)  # Most recent first
    # Keep only last 1000 logs
    if len(_attack_logs) > 1000:
        _attack_logs.pop()


def _update_session_stats(normal: int, attack: int):
    """Update cumulative session statistics."""
    _session_stats["total_analyzed"] += normal + attack
    _session_stats["normal_count"] += normal
    _session_stats["attack_count"] += attack


# ─── Health & Info ─────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if model_service.is_loaded else "models_not_loaded",
        models_loaded=model_service.is_loaded,
        available_models=list(model_service.models.keys()) if model_service.is_loaded else []
    )


@router.get("/models", response_model=ModelsInfoResponse)
async def get_models_info():
    """Get information about available models."""
    models_info = [
        {
            "name": "DNN",
            "type": "Deep Neural Network (MLP)",
            "input_shape": "(78,)",
            "description": "Processes individual network flows",
            "requires_sequence": False,
        },
        {
            "name": "LSTM",
            "type": "Long Short-Term Memory",
            "input_shape": "(10, 78)",
            "description": "Processes sequences of 10 consecutive network flows",
            "requires_sequence": True,
            "sequence_length": SEQUENCE_LENGTH,
        },
        {
            "name": "GRU",
            "type": "Gated Recurrent Unit",
            "input_shape": "(10, 78)",
            "description": "Processes sequences of 10 consecutive network flows",
            "requires_sequence": True,
            "sequence_length": SEQUENCE_LENGTH,
        },
    ]
    return ModelsInfoResponse(models=models_info)


# ─── Single Predictions ───────────────────────────────────────────

@router.post("/predict/dnn", response_model=PredictionResult)
async def predict_dnn(data: SingleFlowInput):
    """Predict a single network flow using the DNN model."""
    try:
        if len(data.features) != NUM_FEATURES:
            raise HTTPException(
                status_code=422,
                detail=f"Expected {NUM_FEATURES} features, got {len(data.features)}"
            )

        result = predict_single_dnn(data.features)

        # Update stats
        if result["prediction"] == "ATTACK":
            _update_session_stats(0, 1)
            _add_attack_log(
                "DNN", "ATTACK", result["attack_probability"], "manual",
                risk_level=result["risk_level"], severity=result["severity"]
            )
        else:
            _update_session_stats(1, 0)

        return PredictionResult(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DNN prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed. Please check your input.")


@router.post("/predict/lstm", response_model=PredictionResult)
async def predict_lstm(data: SequenceFlowInput):
    """Predict using LSTM on a sequence of 10 network flows."""
    try:
        if len(data.sequences) != SEQUENCE_LENGTH:
            raise HTTPException(
                status_code=422,
                detail=f"LSTM requires exactly {SEQUENCE_LENGTH} flows, got {len(data.sequences)}"
            )
        for i, flow in enumerate(data.sequences):
            if len(flow) != NUM_FEATURES:
                raise HTTPException(
                    status_code=422,
                    detail=f"Flow {i+1} has {len(flow)} features, expected {NUM_FEATURES}"
                )

        result = predict_sequence_lstm(data.sequences)

        if result["prediction"] == "ATTACK":
            _update_session_stats(0, 1)
            _add_attack_log(
                "LSTM", "ATTACK", result["attack_probability"], "manual",
                risk_level=result["risk_level"], severity=result["severity"]
            )
        else:
            _update_session_stats(1, 0)

        return PredictionResult(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LSTM prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed. Please check your input.")


@router.post("/predict/gru", response_model=PredictionResult)
async def predict_gru(data: SequenceFlowInput):
    """Predict using GRU on a sequence of 10 network flows."""
    try:
        if len(data.sequences) != SEQUENCE_LENGTH:
            raise HTTPException(
                status_code=422,
                detail=f"GRU requires exactly {SEQUENCE_LENGTH} flows, got {len(data.sequences)}"
            )
        for i, flow in enumerate(data.sequences):
            if len(flow) != NUM_FEATURES:
                raise HTTPException(
                    status_code=422,
                    detail=f"Flow {i+1} has {len(flow)} features, expected {NUM_FEATURES}"
                )

        result = predict_sequence_gru(data.sequences)

        if result["prediction"] == "ATTACK":
            _update_session_stats(0, 1)
            _add_attack_log(
                "GRU", "ATTACK", result["attack_probability"], "manual",
                risk_level=result["risk_level"], severity=result["severity"]
            )
        else:
            _update_session_stats(1, 0)

        return PredictionResult(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GRU prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed. Please check your input.")


# ─── Compare All Models ───────────────────────────────────────────

@router.post("/predict/compare")
async def predict_compare(data: SequenceFlowInput):
    """Run the same 10-flow sequence through all three models."""
    try:
        if len(data.sequences) != SEQUENCE_LENGTH:
            raise HTTPException(
                status_code=422,
                detail=f"Comparison requires exactly {SEQUENCE_LENGTH} flows"
            )
        for i, flow in enumerate(data.sequences):
            if len(flow) != NUM_FEATURES:
                raise HTTPException(
                    status_code=422,
                    detail=f"Flow {i+1} has {len(flow)} features, expected {NUM_FEATURES}"
                )

        results = compare_all_models(data.sequences)

        # Update stats for each model result
        for model_key, result in results.items():
            if result["prediction"] == "ATTACK":
                _add_attack_log(
                    result["model"], "ATTACK",
                    result["attack_probability"], "manual_compare"
                )

        # Count unique prediction (use majority)
        attack_votes = sum(1 for r in results.values() if r["prediction"] == "ATTACK")
        if attack_votes >= 2:
            _update_session_stats(0, 1)
        else:
            _update_session_stats(1, 0)

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compare prediction error: {e}")
        raise HTTPException(status_code=500, detail="Comparison failed. Please check your input.")


# ─── CSV Upload Prediction ────────────────────────────────────────

@router.post("/predict/csv", response_model=CSVPredictionResponse)
async def predict_csv(
    file: UploadFile = File(...),
    model: ModelName = Query(..., description="Model to use")
):
    """Upload a CSV file and run batch predictions."""
    try:
        # Validate file extension
        if file.filename and not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=422, detail="Only .csv files are accepted.")

        # Read file content
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(status_code=422, detail="Uploaded file is empty.")

        # Parse CSV
        df = parse_csv_bytes(content, MAX_UPLOAD_SIZE_BYTES)

        # Extract optional dataset label column before dropping it in validate_csv_columns
        label_cols = [c for c in df.columns if c.strip().lower() == "label"]
        dataset_labels = [str(val) for val in df[label_cols[0]].tolist()] if label_cols else None

        # Validate and reorder columns
        feature_columns = model_service.get_feature_columns()
        df, warnings = validate_csv_columns(df, feature_columns)

        # Clean data
        df, nan_count = clean_dataframe(df)

        # Convert to numpy
        data = df.values.astype("float32")

        # Run batch prediction
        result = predict_csv_batch(data, model.value, feature_columns, dataset_labels=dataset_labels)

        # Update session stats
        _update_session_stats(result["normal_count"], result["attack_count"])

        # Add attack logs
        for pred in result["predictions"]:
            if pred["prediction"] == "ATTACK":
                _add_attack_log(
                    model.value, "ATTACK",
                    pred["attack_probability"], "csv",
                    record_index=pred["index"],
                    risk_level=pred.get("risk_level"),
                    severity=pred.get("severity")
                )

        return CSVPredictionResponse(**result)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"CSV prediction error: {e}")
        raise HTTPException(status_code=500, detail="CSV prediction failed. Please check your file.")


# ─── Model Comparison ─────────────────────────────────────────────

@router.get("/model-comparison", response_model=ModelComparisonResponse)
async def get_model_comparison():
    """Get test-set performance metrics for all models."""
    return ModelComparisonResponse(
        DNN=ModelMetrics(**MODEL_METRICS["DNN"]),
        LSTM=ModelMetrics(**MODEL_METRICS["LSTM"]),
        GRU=ModelMetrics(**MODEL_METRICS["GRU"]),
        best_accuracy="LSTM",
        best_precision="GRU",
        best_recall="DNN",
        best_f1="LSTM",
    )


# ─── Attack Logs ──────────────────────────────────────────────────

@router.get("/attack-logs")
async def get_attack_logs(limit: int = Query(100, ge=1, le=1000)):
    """Get recent attack logs."""
    return {"logs": _attack_logs[:limit], "total": len(_attack_logs)}


@router.delete("/attack-logs")
async def clear_attack_logs():
    """Clear all attack logs."""
    global _log_counter
    _attack_logs.clear()
    _log_counter = 0
    return {"message": "Attack logs cleared."}


@router.get("/attack-logs/export")
async def export_attack_logs():
    """Export attack logs as JSON (frontend can convert to CSV)."""
    return {"logs": _attack_logs}


# ─── Dashboard Stats ──────────────────────────────────────────────

@router.get("/dashboard-stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get current session dashboard statistics."""
    total = _session_stats["total_analyzed"]
    detection_rate = 0.0
    if total > 0:
        detection_rate = round(
            (_session_stats["attack_count"] / total) * 100, 2
        )

    # Recent alerts — last 10 attacks
    recent_alerts = [
        AttackLogEntry(**log) for log in _attack_logs[:10]
    ]

    return DashboardStats(
        total_analyzed=_session_stats["total_analyzed"],
        normal_count=_session_stats["normal_count"],
        attack_count=_session_stats["attack_count"],
        detection_rate=detection_rate,
        recent_alerts=recent_alerts,
    )


@router.delete("/dashboard-stats")
async def reset_dashboard_stats():
    """Reset session statistics."""
    global _log_counter
    _session_stats["total_analyzed"] = 0
    _session_stats["normal_count"] = 0
    _session_stats["attack_count"] = 0
    _attack_logs.clear()
    _log_counter = 0
    return {"message": "Dashboard stats reset."}


# ─── Feature Columns ──────────────────────────────────────────────

@router.get("/feature-columns")
async def get_feature_columns():
    """Return the 78 feature column names in training order."""
    return {"columns": model_service.get_feature_columns()}
