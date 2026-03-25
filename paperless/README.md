# Paperless

## Purpose

This stack runs Paperless-ngx and the supporting services it needs for durable document storage, OCR, parsing, and Office-document conversion. It is the homelab's document ingestion pipeline.

## Active Services

| Service | Image | Why it exists |
| --- | --- | --- |
| `webserver` | `ghcr.io/paperless-ngx/paperless-ngx:latest` | Main Paperless application and web UI. |
| `db` | `docker.io/library/postgres:18` | PostgreSQL database for Paperless metadata. |
| `broker` | `docker.io/library/redis:8` | Redis broker/cache used by Paperless. |
| `gotenberg` | `docker.io/gotenberg/gotenberg:8.25` | Document conversion backend. |
| `tika` | `docker.io/apache/tika:latest` | Content extraction service used during ingestion. |

## Runtime Shape

- Compose file: `paperless/docker-compose.yml`
- Docker Compose project name: `paperless`
- Published port: `8000:8000`
- Environment files:
  - Docker deployment command uses `/home/zeezoux/containers/.env`
  - Paperless application settings live in `paperless/docker-compose.env`
- Persistent data:
  - named volumes `data`, `media`, `pgdata`, `redisdata`
  - bind mounts `paperless/consume` and `paperless/export`
- Key relationships:
  - `webserver` depends on `db`, `broker`, `gotenberg`, and `tika`
  - Paperless is configured to use PostgreSQL instead of SQLite
  - Tika and Gotenberg are enabled for document conversion and extraction

## How To Redeploy Changes

If you changed `paperless/docker-compose.yml`, `paperless/docker-compose.env`, or values in the root `.env`, redeploy the stack with:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p paperless \
  -f /home/zeezoux/containers/paperless/docker-compose.yml \
  up -d
```

If you want newer upstream images first:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p paperless \
  -f /home/zeezoux/containers/paperless/docker-compose.yml \
  pull

docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p paperless \
  -f /home/zeezoux/containers/paperless/docker-compose.yml \
  up -d
```

If you only dropped new files into `paperless/consume`, no redeploy is required. The running stack will process them from the mounted folder.

For a whole-homelab redeploy:

```bash
cd /home/zeezoux/containers
make up
```
