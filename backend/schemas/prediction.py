"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class ModelName(str, Enum):
    DNN = "DNN"
    LSTM = "LSTM"
    GRU = "GRU"


class InputType(str, Enum):
    MANUAL = "manual"
    CSV = "csv"


# ─── Request Schemas ───────────────────────────────────────────────

class SingleFlowInput(BaseModel):
    """78 network flow features for DNN prediction."""
    features: List[float] = Field(
        ...,
        min_length=78,
        max_length=78,
        description="List of 78 numeric feature values in training order"
    )


class SequenceFlowInput(BaseModel):
    """10 consecutive network flows for LSTM/GRU prediction."""
    sequences: List[List[float]] = Field(
        ...,
        min_length=10,
        max_length=10,
        description="List of 10 flows, each containing 78 numeric features"
    )


class CSVPredictionRequest(BaseModel):
    """Query parameters for CSV prediction."""
    model: ModelName = Field(..., description="Model to use for prediction")


# ─── Response Schemas ──────────────────────────────────────────────

class PredictionResult(BaseModel):
    """Single prediction result with threat assessment."""
    model: str
    prediction: str
    attack_probability: float
    normal_probability: float
    risk_level: str
    severity: str
    attack_type_note: str
    flows_analyzed: int = 1
    attacks_detected: int = 0
    benign_detected: int = 1


class CompareResult(BaseModel):
    """Comparison result from all models."""
    dnn: Optional[PredictionResult] = None
    lstm: Optional[PredictionResult] = None
    gru: Optional[PredictionResult] = None


class FlowPredictionDetail(BaseModel):
    """Per-flow or per-sequence prediction detail."""
    index: int
    prediction: str
    attack_probability: float
    normal_probability: float
    risk_level: str
    severity: str
    dataset_label: Optional[str] = None


class CSVPredictionResponse(BaseModel):
    """Batch CSV prediction response."""
    model: str
    total_records: int
    total_predictions: int
    normal_count: int
    attack_count: int
    normal_percentage: float
    attack_percentage: float
    risk_level: str
    severity: str
    attack_type_note: str
    predictions: List[FlowPredictionDetail]


class ModelMetrics(BaseModel):
    """Performance metrics for one model."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float


class ModelComparisonResponse(BaseModel):
    """Test-set performance comparison for all models."""
    DNN: ModelMetrics
    LSTM: ModelMetrics
    GRU: ModelMetrics
    best_accuracy: str
    best_precision: str
    best_recall: str
    best_f1: str


class AttackLogEntry(BaseModel):
    """A single attack log record."""
    id: int
    timestamp: str
    model: str
    prediction: str
    attack_probability: float
    input_type: str
    record_index: Optional[int] = None
    risk_level: Optional[str] = None
    severity: Optional[str] = None


class DashboardStats(BaseModel):
    """Current session statistics for the dashboard."""
    total_analyzed: int
    normal_count: int
    attack_count: int
    detection_rate: float
    recent_alerts: List[AttackLogEntry]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    models_loaded: bool
    available_models: List[str]


class ModelsInfoResponse(BaseModel):
    """Information about available models."""
    models: List[dict]


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: Optional[str] = None
