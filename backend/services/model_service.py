"""
Model Service — loads and caches all DNN/LSTM/GRU models and their scalers.

Models are loaded once at application startup and reused for all requests.
"""

import json
import logging
import numpy as np
import joblib
import tensorflow as tf
from pathlib import Path
from typing import Dict, Any, Optional

from config import (
    DNN_MODEL_PATH, LSTM_MODEL_PATH, GRU_MODEL_PATH,
    DNN_SCALER_PATH, LSTM_SCALER_PATH, GRU_SCALER_PATH,
    FEATURE_COLUMNS_PATH
)

logger = logging.getLogger(__name__)


class ModelService:
    """Manages loading and accessing the trained DNN, LSTM, and GRU models."""

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.scalers: Dict[str, Any] = {}
        self.feature_columns: list = []
        self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def _safe_load_keras_model(self, path: Path) -> Any:
        """Load Keras model with fallback for quantization_config incompatibility."""
        try:
            return tf.keras.models.load_model(str(path))
        except Exception as err:
            if "quantization_config" in str(err):
                import zipfile, tempfile, os
                with zipfile.ZipFile(str(path), 'r') as zin:
                    cfg = json.loads(zin.read('config.json').decode('utf-8'))

                def strip_quant(d):
                    if isinstance(d, dict):
                        d.pop('quantization_config', None)
                        for v in d.values():
                            strip_quant(v)
                    elif isinstance(d, list):
                        for item in d:
                            strip_quant(item)
                strip_quant(cfg)

                with tempfile.NamedTemporaryFile(suffix='.keras', delete=False) as tmp:
                    tmp_path = tmp.name

                try:
                    with zipfile.ZipFile(str(path), 'r') as zin, zipfile.ZipFile(tmp_path, 'w') as zout:
                        for item in zin.infolist():
                            if item.filename == 'config.json':
                                zout.writestr('config.json', json.dumps(cfg))
                            else:
                                zout.writestr(item, zin.read(item.filename))
                    return tf.keras.models.load_model(tmp_path)
                finally:
                    if os.path.exists(tmp_path):
                        try:
                            os.remove(tmp_path)
                        except OSError:
                            pass
            raise

    def load_all(self) -> None:
        """Load all models, scalers, and feature columns at startup."""
        logger.info("Loading models and scalers...")

        # Load feature columns
        try:
            with open(FEATURE_COLUMNS_PATH, "r") as f:
                self.feature_columns = json.load(f)
            logger.info(f"Loaded {len(self.feature_columns)} feature columns")
        except Exception as e:
            logger.error(f"Failed to load feature columns: {e}")
            raise RuntimeError(f"Cannot load feature columns: {e}")

        # Load models
        model_paths = {
            "DNN": DNN_MODEL_PATH,
            "LSTM": LSTM_MODEL_PATH,
            "GRU": GRU_MODEL_PATH,
        }
        for name, path in model_paths.items():
            try:
                self.models[name] = self._safe_load_keras_model(path)
                logger.info(f"Loaded {name} model from {path}")
            except Exception as e:
                logger.error(f"Failed to load {name} model: {e}")
                raise RuntimeError(f"Cannot load {name} model: {e}")

        # Load scalers
        scaler_paths = {
            "DNN": DNN_SCALER_PATH,
            "LSTM": LSTM_SCALER_PATH,
            "GRU": GRU_SCALER_PATH,
        }
        for name, path in scaler_paths.items():
            try:
                self.scalers[name] = joblib.load(str(path))
                logger.info(f"Loaded {name} scaler from {path}")
            except Exception as e:
                logger.error(f"Failed to load {name} scaler: {e}")
                raise RuntimeError(f"Cannot load {name} scaler: {e}")

        self._loaded = True
        logger.info("All models and scalers loaded successfully.")

    def get_model(self, model_name: str) -> Any:
        """Get a loaded Keras model by name."""
        model_name = model_name.upper()
        if model_name not in self.models:
            raise ValueError(f"Model '{model_name}' not found. Available: {list(self.models.keys())}")
        return self.models[model_name]

    def get_scaler(self, model_name: str) -> Any:
        """Get a loaded scaler by model name."""
        model_name = model_name.upper()
        if model_name not in self.scalers:
            raise ValueError(f"Scaler for '{model_name}' not found.")
        return self.scalers[model_name]

    def get_feature_columns(self) -> list:
        """Return the list of 78 feature column names in training order."""
        return self.feature_columns.copy()

    def predict_dnn(self, scaled_input: np.ndarray) -> float:
        """
        Run DNN prediction on a single scaled flow.
        Input shape: (1, 78)
        Returns: attack probability (float).
        """
        model = self.get_model("DNN")
        prediction = model.predict(scaled_input, verbose=0)
        return float(prediction[0][0])

    def predict_lstm(self, scaled_sequence: np.ndarray) -> float:
        """
        Run LSTM prediction on a scaled sequence.
        Input shape: (1, 10, 78)
        Returns: attack probability (float).
        """
        model = self.get_model("LSTM")
        prediction = model.predict(scaled_sequence, verbose=0)
        return float(prediction[0][0])

    def predict_gru(self, scaled_sequence: np.ndarray) -> float:
        """
        Run GRU prediction on a scaled sequence.
        Input shape: (1, 10, 78)
        Returns: attack probability (float).
        """
        model = self.get_model("GRU")
        prediction = model.predict(scaled_sequence, verbose=0)
        return float(prediction[0][0])


# Singleton instance
model_service = ModelService()
