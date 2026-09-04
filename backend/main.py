"""
Network Intrusion Detection System (NIDS) — FastAPI Application

Loads trained DNN, LSTM, and GRU models at startup and serves
the REST API. React frontend runs separately via Vite dev server.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import CORS_ORIGINS
from routes.prediction import router as prediction_router
from services.model_service import model_service

# ─── Logging ──────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan (startup / shutdown) ────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models and scalers at startup."""
    logger.info("=" * 60)
    logger.info("NIDS Backend Starting...")
    logger.info("=" * 60)

    try:
        model_service.load_all()
        logger.info("All models loaded successfully.")
    except Exception as e:
        logger.error(f"FATAL: Failed to load models — {e}")
        logger.warning("App will start but predictions will fail.")

    yield

    logger.info("NIDS Backend shutting down.")


# ─── FastAPI App ──────────────────────────────────────────────────

app = FastAPI(
    title="Network Intrusion Detection System",
    description="Detect malicious network traffic using DNN, LSTM, and GRU deep learning models.",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routes ───────────────────────────────────────────────────

app.include_router(prediction_router)


# ─── Global Exception Handler ─────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return clean JSON."""
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "An unexpected error occurred."},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
