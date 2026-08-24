# Homelab Containers

This repository stores the Docker Compose projects that power the homelab. The root `makefile` is the orchestration layer: it loads `./.env`, assigns each stack a Compose project name based on its directory, and can run the same lifecycle command across every stack or a single stack via `STACK=<name>`.

## Stack Overview

| Stack | Compose project | Active containers | Purpose |
| --- | --- | --- | --- |
| `api` | `api` | `api` | Custom Node/Express automation API for YNAB gold tracking, SMS parsing, and weather helpers. |
| `cloudflared` | `cloudflared` | `cloudflared` | Cloudflare Tunnel that exposes internal services on the shared `web` network. |
| `home_assistant` | `home_assistant` | `homeassistant`, `mosquitto` | Home automation hub plus a local MQTT broker for device integrations. |
| `jellyfin` | `jellyfin` | `qbittorrent`, `jellyfin`, `seerr`, `prowlarr`, `sonarr`, `radarr`, `bazarr` | LAN-only media streaming, requests, download automation, and automatic subtitles. |
| `n8n` | `n8n` | `n8n` | Workflow automation service backed by a persistent SQLite data volume. |
| `portainer` | `portainer` | `portainer` | Docker management UI for the homelab. |

The Jellyfin stack intentionally excludes LAN file sharing; media access is handled through Jellyfin and the automation apps.

## Shared Prerequisites

- Install Docker Engine and the Docker Compose plugin on the host.
- Create `/home/zeezoux/containers/.env` from `/home/zeezoux/containers/.env.example`.
- Create the external Docker network used by the reverse-proxied stacks if it does not already exist:

```bash
docker network create web
```

- Keep stack-specific config files in place where required:
  - `home_assistant/ha/config/*`
  - `home_assistant/mosquitto/config/mosquitto.conf`
  - `cloudflared/cloudflared/*`

## Using The Root Makefile

Run these commands from `/home/zeezoux/containers`:

Plain `make` still defaults to `make up`.

| Command | What it does |
| --- | --- |
| `make help` | Shows the available targets, stacks, and a few examples. |
| `make stacks` | Prints the supported stack names. |
| `make up` | Starts every stack with `up -d --build --remove-orphans`. This rebuilds local images such as `api`, but it does not pull newer remote images first. |
| `make up STACK=api` | Starts only the `api` stack with the same flags. |
| `make pull STACK=n8n` | Pulls newer upstream images for one stack before you restart or bring it back up. Omit `STACK` to pull every stack in sequence. |
| `make build STACK=api` | Builds local images for one stack without starting it. |
| `make stop` | Stops every stack without removing containers. Add `STACK=<name>` to scope it. |
| `make down STACK=api` | Removes one stack's containers and Compose-managed networks. Omit `STACK` to apply it to every stack. |
| `make restart STACK=api` | Stops then starts one stack again with `up -d --build --remove-orphans`. |
| `make recreate STACK=api` | Force-recreates one stack with `up -d --force-recreate`. Useful when you want fresh containers without changing the compose files. |
| `make ps` | Shows container status for every stack in sequence. Add `STACK=<name>` to focus on one stack. |
| `make logs STACK=api` | Streams logs for one stack. Optional: `SERVICE=api` and `TAIL=200`. |
| `make config STACK=api` | Renders the merged Compose config for inspection. |

`STACK` must match one of: `api`, `cloudflared`, `home_assistant`, `jellyfin`, `n8n`, `portainer`.

## When To Use `make` vs Direct Compose Commands

Use the root `makefile` when:

- you want to reconcile the whole homelab in one command
- you want a consistent command format for either one stack or all stacks
- you changed the local `api` code and want shorthand like `make up STACK=api`
- you need to pull a newer upstream image for one stack with `make pull STACK=<name>`

Use direct `docker compose` commands when:

- you need a one-off Compose flag that is not wrapped by the root `makefile`
- you are debugging an unusual Compose behavior and want the raw command line
- you want to experiment without changing the shared shortcuts

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
make up STACK=api
```

```bash
make pull STACK=n8n
make up STACK=n8n
```

```bash
make logs STACK=api SERVICE=api TAIL=200
```
