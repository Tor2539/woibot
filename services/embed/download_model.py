"""Bake BAAI/bge-m3 into the image at build time."""

import os
import shutil

from huggingface_hub import snapshot_download

DEST = os.environ.get("EMBED_MODEL_PATH", "/models/bge-m3")

# Only the files sentence-transformers needs for dense 1024-d embeddings.
PATTERNS = [
    "config.json",
    "config_sentence_transformers.json",
    "modules.json",
    "sentence_bert_config.json",
    "model.safetensors",
    "pytorch_model.bin",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "sentencepiece.bpe.model",
    "1_Pooling/*",
]

path = snapshot_download(repo_id="BAAI/bge-m3", local_dir=DEST, allow_patterns=PATTERNS)
print("downloaded to", path)

# bge-m3 is ~2.27GB fp32. Loading the shipped pytorch_model.bin peaks at ~2x
# that (state dict + params) and OOMs a 4Gi Cloud Run instance. Convert to
# safetensors at build time so runtime can mmap with low_cpu_mem_usage.
bin_path = os.path.join(DEST, "pytorch_model.bin")
st_path = os.path.join(DEST, "model.safetensors")
if os.path.exists(bin_path) and not os.path.exists(st_path):
    print("converting pytorch_model.bin -> model.safetensors (build time, one-off)")
    import torch
    from transformers import AutoModel

    model = AutoModel.from_pretrained(DEST, torch_dtype=torch.float32)
    model.save_pretrained(DEST, safe_serialization=True)
    del model
    os.remove(bin_path)

# Drop HF download bookkeeping so the image stays lean.
shutil.rmtree(os.path.join(DEST, ".cache"), ignore_errors=True)

for root, _dirs, files in os.walk(DEST):
    for f in files:
        p = os.path.join(root, f)
        print(f"{os.path.getsize(p):>12}  {os.path.relpath(p, DEST)}")
