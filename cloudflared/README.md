# Cloudflared

## Purpose

This stack runs the Cloudflare Tunnel client for the homelab. It is the bridge between Cloudflare and the internal Docker services attached to the shared `web` network, so it is what makes reverse-proxied services reachable without publishing every service directly on the host.

## Active Services

| Service | Image | Why it exists |
| --- | --- | --- |
| `cloudflared` | `cloudflare/cloudflared:latest` | Runs `tunnel run` and forwards traffic from Cloudflare into the homelab. |

## Runtime Shape

- Compose file: `cloudflared/docker-compose.yml`
- Docker Compose project name: `cloudflared`
- Network: external `web`
- Mounted config: `cloudflared/cloudflared:/etc/cloudflared`
- Environment source for Docker deployment: `/home/zeezoux/containers/.env`
- Required variable: `TUNNEL_TOKEN`
- Host mapping: `host.docker.internal:host-gateway`

This stack is configuration-driven. There is no local image build in this directory.

## How To Redeploy Changes

If you changed the compose file, tunnel token, or files under `cloudflared/cloudflared`, redeploy this stack with:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p cloudflared \
  -f /home/zeezoux/containers/cloudflared/docker-compose.yml \
  up -d
```

If you want the latest upstream Cloudflared image first:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p cloudflared \
  -f /home/zeezoux/containers/cloudflared/docker-compose.yml \
  pull

docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p cloudflared \
  -f /home/zeezoux/containers/cloudflared/docker-compose.yml \
  up -d
```

If you prefer to redeploy the entire homelab instead of just this stack:

```bash
cd /home/zeezoux/containers
make up
```
