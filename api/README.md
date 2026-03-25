# API

## Purpose

This stack runs the custom Node/Express automation API used in the homelab. It is a personal utility service that currently handles YNAB gold-tracking workflows, gold portfolio analytics, SMS parsing helpers, and weather-message generation.

## Active Services

| Service | Build source | Why it exists |
| --- | --- | --- |
| `api` | Local build from `api/Dockerfile` | Runs the custom application code in `api/src` on an internal Docker network. |

## Runtime Shape

- Compose file: `api/docker-compose.yml`
- Docker Compose project name: `api`
- Build context: `api/`
- Network: external `web`
- Exposed internal port: `4211`
- Environment source for Docker deployment: `/home/zeezoux/containers/.env`
- Docker deployment currently passes `GENERIC_TIMEZONE=${TIMEZONE}`
- No host port is published by this compose file, so this service is meant to be reached from other containers on the `web` network

Important code locations:

- `api/src/api.js` wires the Express routes
- `api/src/endpoints/golden-update.js` holds the YNAB gold ROI helpers
- `api/src/endpoints/goldPortfolioAnalyticsCalculator.js` calculates portfolio analytics
- `api/src/sms/utils.js` parses SMS text into structured transaction data

Main routes today:

- `GET /health`
- `GET /ynab/golden-update`
- `POST /ynab/golden-update`
- `GET /ynab/golden-update-single`
- `POST /ynab/golden-update-single`
- `POST /sms`
- `GET /weather`

## How To Redeploy Changes

If you changed application code under `api/src`, the `Dockerfile`, or `api/docker-compose.yml`, rebuild and redeploy this stack with:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p api \
  -f /home/zeezoux/containers/api/docker-compose.yml \
  up -d --build
```

That is the important difference for this stack: local code changes require `--build` because the container image is built from this repository.

If you want to redeploy the whole homelab instead, the root `makefile` already does the same kind of rebuild for the `api` stack:

```bash
cd /home/zeezoux/containers
make up
```

You can also use:

```bash
cd /home/zeezoux/containers
make restart
```

Both `make up` and `make restart` rebuild the `api` image because they run `docker compose ... up -d --build` for every stack.
