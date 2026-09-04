"""
Verification script: loads all 3 models and scalers and runs a test prediction.
"""
import os
import json
import numpy as np

def run_test():
    print("Testing model imports...")
    import tensorflow as tf
    import joblib
    print(f"TensorFlow Version: {tf.__version__}")

    from config import (
        DNN_MODEL_PATH, LSTM_MODEL_PATH, GRU_MODEL_PATH,
        DNN_SCALER_PATH, LSTM_SCALER_PATH, GRU_SCALER_PATH,
        FEATURE_COLUMNS_PATH
    )

    with open(FEATURE_COLUMNS_PATH) as f:
        columns = json.load(f)
    print(f"Loaded {len(columns)} feature columns.")
    assert len(columns) == 78, "Must have 78 features"

    # Load scalers
    print("Loading scalers...")
    dnn_scaler = joblib.load(DNN_SCALER_PATH)
    lstm_scaler = joblib.load(LSTM_SCALER_PATH)
    gru_scaler = joblib.load(GRU_SCALER_PATH)
    print("Scalers loaded.")

    # Load models
    print("Loading models...")
    dnn_model = tf.keras.models.load_model(str(DNN_MODEL_PATH))
    print("DNN loaded successfully!")
    lstm_model = tf.keras.models.load_model(str(LSTM_MODEL_PATH))
    print("LSTM loaded successfully!")
    gru_model = tf.keras.models.load_model(str(GRU_MODEL_PATH))
    print("GRU loaded successfully!")

    # Test DNN inference
    sample_flow = np.zeros((1, 78), dtype=np.float32)
    scaled_dnn = dnn_scaler.transform(sample_flow)
    pred_dnn = dnn_model.predict(scaled_dnn, verbose=0)
    print(f"DNN Test Prediction (Raw Probability): {float(pred_dnn[0][0]):.6f}")

    # Test LSTM inference (1, 10, 78)
    sample_seq = np.zeros((10, 78), dtype=np.float32)
    scaled_lstm = lstm_scaler.transform(sample_seq).reshape(1, 10, 78)
    pred_lstm = lstm_model.predict(scaled_lstm, verbose=0)
    print(f"LSTM Test Prediction (Raw Probability): {float(pred_lstm[0][0]):.6f}")

    # Test GRU inference (1, 10, 78)
    scaled_gru = gru_scaler.transform(sample_seq).reshape(1, 10, 78)
    pred_gru = gru_model.predict(scaled_gru, verbose=0)
    print(f"GRU Test Prediction (Raw Probability): {float(pred_gru[0][0]):.6f}")

    print("\nALL 3 TRAINED MODELS VERIFIED AND WORKING PROPERLY!")

if __name__ == "__main__":
    run_test()
