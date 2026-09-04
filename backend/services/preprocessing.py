"""
Preprocessing Service — validates, cleans, scales, and reshapes input data.
"""

import logging
import numpy as np
import pandas as pd
from typing import List, Tuple
from io import BytesIO

from config import NUM_FEATURES, SEQUENCE_LENGTH

logger = logging.getLogger(__name__)


def validate_feature_values(features: List[float]) -> List[float]:
    """
    Validate a single flow's feature values.
    Replaces NaN/inf with 0.
    """
    cleaned = []
    for i, val in enumerate(features):
        if val is None or np.isnan(val) or np.isinf(val):
            cleaned.append(0.0)
        else:
            cleaned.append(float(val))
    return cleaned


def validate_csv_columns(
    df: pd.DataFrame,
    feature_columns: List[str]
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Validate and reorder CSV columns to match training feature order.
    Returns: (reordered DataFrame with only feature columns, list of warnings).
    """
    warnings = []

    # Normalize column names (strip whitespace)
    df.columns = df.columns.str.strip()

    # Remove Label column if present
    label_cols = [c for c in df.columns if c.lower() == "label"]
    if label_cols:
        df = df.drop(columns=label_cols)
        warnings.append(f"Removed label column(s): {label_cols}")

    # Check for missing columns
    missing = [col for col in feature_columns if col not in df.columns]
    if missing:
        raise ValueError(
            f"CSV is missing {len(missing)} required feature column(s): {missing[:10]}"
            + ("..." if len(missing) > 10 else "")
        )

    # Check for extra columns (just warn, don't fail)
    extra = [col for col in df.columns if col not in feature_columns]
    if extra:
        warnings.append(f"Ignoring {len(extra)} extra column(s): {extra[:5]}")

    # Reorder to match training feature order
    df = df[feature_columns].copy()

    return df, warnings


def clean_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """
    Clean a DataFrame: convert to numeric, replace NaN/inf with 0.
    Returns: (cleaned DataFrame, number of rows cleaned).
    """
    original_shape = df.shape[0]

    # Convert all columns to numeric, coercing errors to NaN
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Replace inf with NaN, then fill NaN with 0
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    nan_count = int(df.isna().sum().sum())
    df.fillna(0, inplace=True)

    return df, nan_count


def scale_features_single(features: np.ndarray, scaler) -> np.ndarray:
    """
    Scale a single flow's features using the provided scaler.
    Input shape: (1, 78)
    Output shape: (1, 78)
    """
    return scaler.transform(features.reshape(1, -1))


def scale_features_batch(features: np.ndarray, scaler) -> np.ndarray:
    """
    Scale a batch of flows.
    Input shape: (N, 78)
    Output shape: (N, 78)
    """
    return scaler.transform(features)


def create_sequences(data: np.ndarray, seq_length: int = SEQUENCE_LENGTH) -> np.ndarray:
    """
    Create sequences of consecutive flows for LSTM/GRU.
    Uses non-overlapping windows to preserve independence.

    Input shape: (N, 78)
    Output shape: (num_sequences, seq_length, 78)
    """
    num_flows = data.shape[0]
    num_sequences = num_flows // seq_length

    if num_sequences == 0:
        raise ValueError(
            f"Not enough flows to create sequences. "
            f"Need at least {seq_length} flows, got {num_flows}."
        )

    # Trim to exact multiple of seq_length
    trimmed = data[: num_sequences * seq_length]
    sequences = trimmed.reshape(num_sequences, seq_length, -1)

    return sequences


def parse_csv_bytes(file_bytes: bytes, max_size_bytes: int) -> pd.DataFrame:
    """
    Parse uploaded CSV bytes into a DataFrame.
    Validates file size.
    """
    if len(file_bytes) > max_size_bytes:
        raise ValueError(
            f"File too large. Maximum size is {max_size_bytes // (1024 * 1024)} MB."
        )

    try:
        df = pd.read_csv(BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Failed to parse CSV file: {str(e)}")

    if df.empty:
        raise ValueError("CSV file is empty.")

    return df
