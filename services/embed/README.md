# woibot-embed — BGE-M3 embedding service

Self-contained CPU embedding service for the woibot stack. Loads `BAAI/bge-m3`
(fp32, baked into the image at build time as safetensors) and serves dense
1024-dim vectors.

- `GET /health` → `{"ok":true,"model":"bge-m3","dim":1024}`
- `POST /embed` → `{"vectors":[[1024 floats], ...]}` (body: `{"texts":[...],"normalize":true}`)

## Deployed

| | |
|---|---|
| Service | `woibot-embed` (asia-southeast1) |
| URL | https://woibot-embed-443vhqtiuq.as.a.run.app |
| Auth | private — `roles/run.invoker` for `woibot-web@woibot.iam.gserviceaccount.com` |
| Limits | 4Gi / 2 vCPU, min-instances 0, max-instances 2, timeout 300s, port 8080 |

## Build

```bash
gcloud builds submit --config=cloudbuild-embed.yaml --project=woibot
```

The Dockerfile downloads the model during build and converts
`pytorch_model.bin` → `model.safetensors`. That conversion matters: the shipped
`.bin` loads with a ~2x peak (state dict + params, ~4.5GB) and OOMs a 4Gi
instance; safetensors + `low_cpu_mem_usage` keeps resident memory near 1x.

## Deploy

```bash
gcloud run deploy woibot-embed \
  --image=asia-southeast1-docker.pkg.dev/woibot/woibot/embed:v1 \
  --no-allow-unauthenticated \
  --service-account=woibot-web@woibot.iam.gserviceaccount.com \
  --memory=4Gi --cpu=2 --region=asia-southeast1 --port=8080 \
  --min-instances=0 --max-instances=2 --timeout=300 --project=woibot
```

## Calling it (id token flow)

From inside a Cloud Run service (both services run as `woibot-web@`):

```bash
URL=https://woibot-embed-443vhqtiuq.as.a.run.app
TOKEN=$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=$URL")

curl -s -H "Authorization: Bearer $TOKEN" "$URL/health"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"texts":["สวัสดีครับ","ระบบฝากถอนทำงานปกติหรือไม่"]}' "$URL/embed"
```

From a workstation / CI with user credentials:

```bash
curl -s -H "Authorization: Bearer $(gcloud auth print-identity-token)" "$URL/health"
```

In Node (`apps/web`), `google-auth-library`'s `IdTokenClient` does the same
against the metadata server:

```ts
import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth();
const client = await auth.getIdTokenClient(process.env.EMBED_URL!);
const res = await client.request({ url: `${process.env.EMBED_URL}/embed`,
  method: "POST", data: { texts } });
```

## Env knobs

`EMBED_BATCH_SIZE` (default 4), `EMBED_MAX_SEQ_LENGTH` (512), `EMBED_THREADS` (2),
`EMBED_MAX_BATCH_CHARS` (200000), `EMBED_MODEL_PATH` (`/models/bge-m3`).

## Local run

```bash
docker build -t embed services/embed
docker run -p 8080:8080 embed
```
