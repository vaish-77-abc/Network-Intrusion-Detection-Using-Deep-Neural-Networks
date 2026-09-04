# Network Intrusion Detection System (NIDS) Using Deep Neural Networks

An enterprise cybersecurity web application for classifying and detecting malicious network intrusions using deep neural networks (**DNN**, **LSTM**, and **GRU**).

The system is trained on the **CIC-IDS-2017** dataset (400,000 balanced flows with 78 numerical features) to perform real-time binary classification (**BENIGN** vs. **ATTACK**).

---

## Architecture Overview

```
DL_CP/
├── backend/
│   ├── config.py                 # Centralized configuration & environment settings
│   ├── main.py                   # FastAPI application & lifecycle model loading
│   ├── models/                   # Actual trained .keras models & .pkl scalers
│   │   ├── dnn_intrusion_model.keras
│   │   ├── lstm_intrusion_model.keras
│   │   ├── gru_intrusion_model.keras
│   │   ├── dnn_scaler.pkl
│   │   ├── lstm_scaler.pkl
│   │   ├── gru_scaler.pkl
│   │   └── feature_columns.json
│   ├── routes/
│   │   └── prediction.py         # REST API endpoints
│   ├── schemas/
│   │   └── prediction.py         # Pydantic validation schemas
│   ├── services/
│   │   ├── model_service.py      # Cached inference engine for DNN, LSTM, GRU
│   │   ├── preprocessing.py      # Data cleaning, scaling & sequence generator
│   │   └── prediction_service.py # Core classification pipeline
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/           # Sidebar, ToastContainer
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Traffic stats, donut & timeline charts, alerts
│   │   │   ├── SinglePrediction.jsx  # Manual 78-feature form & CSV input mode
│   │   │   ├── BatchPrediction.jsx   # CSV upload, detection stats & classification table
│   │   │   ├── ModelComparison.jsx   # Benchmark metrics & Bar chart
│   │   │   ├── AttackLogs.jsx    # Real-time incident logs with CSV export
│   │   │   └── About.jsx         # Architecture & dataset specifications
│   │   ├── context/AppContext.jsx # Global session & state management
│   │   ├── services/api.js       # Axios client communicating with FastAPI
│   │   ├── constants/features.js # Exact 78-feature definitions & sample vectors
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css             # Cyber-dark theme design system
│   ├── package.json
│   └── vite.config.js            # Vite setup with /api proxy to localhost:8000
│
└── README.md
```

---

## Deep Learning Models & Benchmark Results

All models evaluated on the CIC-IDS-2017 test set:

| Model | Architecture | Input Shape | Accuracy | Precision | Recall | F1 Score | Best At |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DNN / MLP** | Feedforward Dense | `(78,)` | 98.8725% | 98.3283% | **99.4365%** | 98.8793% | Highest Recall |
| **LSTM** | 64 Units + 32 Dense + Dropout | `(10, 78)` | **99.2556%** | 99.5417% | 98.9688% | **99.2544%** | Highest Overall Accuracy & F1 |
| **GRU** | 64 Units + 32 Dense + Dropout | `(10, 78)` | 99.0947% | **99.5882%** | 98.5971% | 99.0902% | Highest Precision |

> **Note on Sequence Models:** The LSTM and GRU models evaluate sequences of **10 consecutive network flows** using original row order from the capture files.

---

## How to Run Locally

### 1. Start the FastAPI Backend

Open a terminal and navigate to `backend`:

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend starts up and loads all three models into memory:
- API Documentation (Swagger UI): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### 2. Start the React Frontend

Open a second terminal and navigate to `frontend`:

```powershell
cd frontend
npm install
npm run dev
```

Open your browser to:
```
http://localhost:5173
```

---

## API Endpoints

- `GET /api/health` — System status & loaded models
- `GET /api/models` — Model specifications & input shape info
- `POST /api/predict/dnn` — Single flow prediction using 78 features
- `POST /api/predict/lstm` — Sequential prediction on 10 consecutive flows
- `POST /api/predict/gru` — Sequential prediction on 10 consecutive flows
- `POST /api/predict/compare` — Compare all 3 models on a 10-flow sequence
- `POST /api/predict/csv?model={DNN|LSTM|GRU}` — Upload CSV dataset file for batch prediction
- `GET /api/dashboard-stats` — Live session statistics & recent alerts
- `GET /api/model-comparison` — Evaluation metrics across models
- `GET /api/attack-logs` — Incident logs with export capability
- `DELETE /api/attack-logs` — Clear incident logs

---

## Key Features

1. **Exact Reference UI Design:** Deep dark cybersecurity aesthetic with glowing stat cards, responsive sidebar, traffic distribution donut, dynamic time-series charts, and alert feeds.
2. **Dual Input Mode:**
   - **Manual Input:** Complete 78-feature grouped form with sample data pre-loader. For LSTM/GRU, includes a 10-flow sequence tab selector.
   - **Upload CSV:** Drag-and-drop support for CIC-IDS-2017 compatible CSV files.
3. **Model Selection:** Seamless switching between DNN, LSTM, and GRU models directly impacts inference in real-time.
4. **No Mock Data:** Predictions, probabilities, attack percentages, and session counters are generated by real TensorFlow `.keras` models and scikit-learn scalers.
