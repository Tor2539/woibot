"""BGE-M3 embedding service (CPU, Cloud Run).

GET  /health              -> {"ok": true, "model": "bge-m3", "dim": 1024}
POST /embed {"texts": []} -> {"vectors": [[1024 floats], ...]}
"""

import logging
import os
import threading
from contextlib import asynccontextmanager
from typing import List

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_NAME = os.environ.get("EMBED_MODEL_NAME", "BAAI/bge-m3")
MODEL_PATH = os.environ.get("EMBED_MODEL_PATH", "/models/bge-m3")
EMBED_DIM = 1024
MAX_BATCH_CHARS = int(os.environ.get("EMBED_MAX_BATCH_CHARS", "200000"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("embed")

_state = {"model": None}
_lock = threading.Lock()


def _load_model():
    import torch
    from sentence_transformers import SentenceTransformer

    torch.set_num_threads(int(os.environ.get("EMBED_THREADS", "2")))
    src = MODEL_PATH if os.path.isdir(MODEL_PATH) else MODEL_NAME
    log.info("loading %s from %s", MODEL_NAME, src)
    model = SentenceTransformer(src, device="cpu", model_kwargs={"low_cpu_mem_usage": True})
    model.max_seq_length = int(os.environ.get("EMBED_MAX_SEQ_LENGTH", "512"))
    model.eval()
    log.info("model loaded; dim=%s", model.get_sentence_embedding_dimension())
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    _state["model"] = _load_model()
    yield
    _state["model"] = None


app = FastAPI(title="woibot-embed", version="1.0.0", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., description="Texts to embed")
    normalize: bool = True


class EmbedResponse(BaseModel):
    vectors: List[List[float]]


@app.get("/health")
def health():
    return {"ok": True, "model": "bge-m3", "dim": EMBED_DIM}


@app.get("/")
def root():
    return {"service": "woibot-embed", "model": "bge-m3", "dim": EMBED_DIM}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    model = _state["model"]
    if model is None:
        raise HTTPException(status_code=503, detail="model not loaded")
    texts = req.texts
    if not texts:
        return EmbedResponse(vectors=[])
    if any(not isinstance(t, str) for t in texts):
        raise HTTPException(status_code=400, detail="texts must be an array of strings")
    if sum(len(t) for t in texts) > MAX_BATCH_CHARS:
        raise HTTPException(status_code=413, detail=f"batch too large (>{MAX_BATCH_CHARS} chars)")

    clean = [t if t.strip() else " " for t in texts]
    with _lock:
        vecs = model.encode(
            clean,
            batch_size=int(os.environ.get("EMBED_BATCH_SIZE", "4")),
            normalize_embeddings=req.normalize,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
    vecs = np.asarray(vecs, dtype=np.float32)
    if vecs.ndim != 2 or vecs.shape[1] != EMBED_DIM:
        raise HTTPException(status_code=500, detail=f"unexpected shape {vecs.shape}")
    return EmbedResponse(vectors=vecs.tolist())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
