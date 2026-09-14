# ntfy Notification Server

This stack runs a private ntfy server for homelab notifications. It is reachable directly on the LAN at port `8082` and through the shared `web` network for Cloudflare Tunnel.

## Before Starting

Add the externally visible URL to the repository root `.env`:

```dotenv
NTFY_BASE_URL=https://ntfy.example.com
```

Use the exact URL that the mobile app and integrations will use. HTTPS is required before sending credentials over the internet.

The external Docker network must already exist:

```bash
docker network inspect web >/dev/null 2>&1 || docker network create web
```

If you expose ntfy through the existing remotely managed Cloudflare Tunnel, add a public-hostname route with:

- Hostname: the hostname used by `NTFY_BASE_URL`
- Service type: `HTTP`
- Service URL: `ntfy:80`

Do not add a Cloudflare Access login page in front of ntfy. ntfy clients and integrations use its API directly and authenticate with ntfy credentials or access tokens.

## Start and Create the Administrator

From the repository root:

```bash
make up STACK=ntfy
```

Create the first administrator. The command prompts for a password without storing it in the repository or shell history:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p ntfy \
  -f ntfy/docker-compose.yml \
  exec ntfy ntfy user add --role=admin joseph
```

The server uses `deny-all` as its default access policy, so anonymous clients cannot read from or write to any topic. The administrator can access every topic.

Open `NTFY_BASE_URL`, sign in as the administrator, and subscribe to the topics you want. A useful initial set is:

- `critical` for Uptime Kuma, backup failures, and security events
- `updates` for Diun image-update notifications
- `media` for Seerr, Sonarr, Radarr, Bazarr, and Jellyfin
- `home` for Home Assistant

## Create an Integration Token

Prefer an access token over sharing the administrator password with services:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p ntfy \
  -f ntfy/docker-compose.yml \
  exec ntfy ntfy token add --label="homelab integrations" joseph
```

Store the returned token in the root `.env` or in the application's own protected configuration when an integration needs it. Never commit tokens.

## Test

Check the local health endpoint:

```bash
curl http://localhost:8082/v1/health
```

Then send a notification. `curl -u joseph` prompts for the password:

```bash
curl \
  -u joseph \
  -H "Title: Mateo's Lab" \
  -H "Priority: 3" \
  -H "Tags: white_check_mark" \
  -d "ntfy is working" \
  "${NTFY_BASE_URL}/mateos-lab"
```

Alternatively, authenticate non-interactively with a protected token:

```bash
curl \
  -H "Authorization: Bearer ${NTFY_TOKEN}" \
  -H "Title: Mateo's Lab" \
  -d "ntfy is working" \
  "${NTFY_BASE_URL}/mateos-lab"
```

## Phone Setup

Install the ntfy app, add `NTFY_BASE_URL` as a custom server, sign in, and subscribe to the desired topics. The server forwards poll metadata to `ntfy.sh` so iPhones can wake promptly; the notification title and body remain on this server and are fetched by the phone.

## Storage and Maintenance

All durable state lives in `ntfy/data/`:

- `auth.db` stores users, tokens, and access rules
- `cache.db` stores the persistent message cache
- `attachments/` stores notification attachments, capped at 1 GB

The directory is ignored by Git and is included when Kopia backs up the Compose repository. Protect its backups because the authentication database is sensitive.

Update ntfy deliberately after reviewing the release:

```bash
make update STACK=ntfy
```

View status and logs with:

```bash
make ps STACK=ntfy
make logs STACK=ntfy SERVICE=ntfy TAIL=200
```
