# Homelab Containers

This repository stores the Docker Compose projects that power the homelab. The root `makefile` is the orchestration layer: it loads `/home/zeezoux/containers/.env`, assigns each stack a Compose project name based on its directory, and runs the same lifecycle command across every stack.

## Stack Overview

| Stack | Compose project | Active containers | Purpose |
| --- | --- | --- | --- |
| `api` | `api` | `api` | Custom Node/Express automation API for YNAB gold tracking, SMS parsing, and weather helpers. |
| `cloudflared` | `cloudflared` | `cloudflared` | Cloudflare Tunnel that exposes internal services on the shared `web` network. |
| `home_assistant` | `home_assistant` | `homeassistant`, `mosquitto` | Home automation hub plus a local MQTT broker for device integrations. |
| `jellyfin` | `jellyfin` | `jellyfin` | Media streaming server. The compose file also keeps the wider media stack commented out for later use. |
| `n8n` | `n8n` | `n8n` | Workflow automation service backed by a persistent SQLite data volume. |
| `paperless` | `paperless` | `webserver`, `db`, `broker`, `gotenberg`, `tika` | Document ingestion, OCR, and search stack. |
| `portainer` | `portainer` | `portainer` | Docker management UI for the homelab. |

The commented media-stack services in `jellyfin/docker-compose.yml` are still part of the intended design: `jellyseerr`, `prowlarr`, `sonarr`, `radarr`, `qbittorrent`, and `samba`.

## Shared Prerequisites

- Install Docker Engine and the Docker Compose plugin on the host.
- Create `/home/zeezoux/containers/.env` from `/home/zeezoux/containers/.env.example`.
- Create the external Docker network used by the reverse-proxied stacks if it does not already exist:

```bash
docker network create web
```

- Keep stack-specific config files in place where required:
  - `paperless/docker-compose.env`
  - `home_assistant/ha/config/*`
  - `home_assistant/mosquitto/config/mosquitto.conf`
  - `cloudflared/cloudflared/*`

## Using The Root Makefile

Run these commands from `/home/zeezoux/containers`:

| Command | What it does |
| --- | --- |
| `make up` | Starts every stack with `up -d --build --remove-orphans`. This rebuilds local images such as `api`, but it does not pull newer remote images first. |
| `make stop` | Stops every stack without removing containers. |
| `make down` | Removes every stack's containers and networks created by Compose. |
| `make restart` | Stops every stack, then starts them again with `up -d --build --remove-orphans`. |
| `make recreate` | Force-recreates every stack with `up -d --force-recreate`. Useful when you want fresh containers without changing the compose files. |
| `make ps` | Shows container status for each stack in sequence. |

Important detail: the current `makefile` has no `pull` target. `make up` and `make restart` rebuild local images, but they do not fetch newer versions of remote images such as `n8n`, `jellyfin`, `paperless`, or `portainer`.

## When To Use `make` vs Direct Compose Commands

Use the root `makefile` when:

- you want to reconcile the whole homelab in one command
- you changed the local `api` code and do not mind restarting everything
- you want a consistent all-stacks stop/start workflow

Use direct `docker compose` commands when:

- you only changed one stack
- you want to avoid restarting unrelated services
- you need to pull a newer upstream image for one stack

Direct stack command template:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p <stack> \
  -f /home/zeezoux/containers/<stack>/docker-compose.yml \
  up -d
```

Examples:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p api \
  -f /home/zeezoux/containers/api/docker-compose.yml \
  up -d --build
```

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
