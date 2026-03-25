# n8n

## Purpose

This stack runs the homelab's workflow automation service. It is set up to live behind the shared `web` network and a reverse proxy, with its editor URL and webhook URL controlled from the root environment file.

## Active Services

| Service | Image | Why it exists |
| --- | --- | --- |
| `n8n` | `n8nio/n8n:latest` | Workflow automation engine with persistent user data stored in a Docker volume. |

## Runtime Shape

- Compose file: `n8n/docker-compose.yml`
- Docker Compose project name: `n8n`
- Network: external `web`
- Container user: `1000:1000`
- Persistent volume: `n8n_data:/home/node/.n8n`
- Environment source for Docker deployment: `/home/zeezoux/containers/.env`
- Important variables:
  - `TIMEZONE`
  - `N8N_HOST`
  - `N8N_PUBLIC_URL`
  - `N8N_WEBHOOKS_URL`
- Database mode: SQLite inside the persistent `n8n_data` volume
- No host port is published by this compose file; access is expected to come through the reverse proxy/tunnel layer on the `web` network

## How To Redeploy Changes

If you changed `n8n/docker-compose.yml` or values in the root `.env`, redeploy the stack with:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p n8n \
  -f /home/zeezoux/containers/n8n/docker-compose.yml \
  up -d
```

If you want the latest upstream `n8n` image first:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p n8n \
  -f /home/zeezoux/containers/n8n/docker-compose.yml \
  pull

docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p n8n \
  -f /home/zeezoux/containers/n8n/docker-compose.yml \
  up -d
```

If you want to redeploy the entire homelab instead:

```bash
cd /home/zeezoux/containers
make up
```
