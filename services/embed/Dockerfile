FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    TOKENIZERS_PARALLELISM=false \
    HF_HOME=/models/hf \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only torch first so the resolver never pulls CUDA wheels.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1

COPY requirements.txt .
RUN pip install -r requirements.txt

# Bake the model into the image (no runtime HF download, no secrets needed).
COPY download_model.py .
RUN python download_model.py && rm download_model.py

ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    HF_HOME=/models/hf \
    EMBED_MODEL_PATH=/models/bge-m3

COPY app.py .

RUN useradd -m -u 1000 appuser && chown -R appuser /models
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-keep-alive", "75"]
