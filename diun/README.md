# DIUN Image Update Notifications

This stack runs [DIUN](https://crazymax.dev/diun/) as a notification-only image watcher. It checks the images used by running containers every 12 hours and publishes available updates to the private ntfy server. DIUN does not pull images, restart containers, or apply upgrades.

## Before Starting

Start ntfy first and ensure the shared `web` network exists:

```bash
docker network inspect web >/dev/null 2>&1 || docker network create web
make up STACK=ntfy
```

DIUN publishes internally to `http://ntfy:80`, so notifications can still reach the ntfy cache when the public Cloudflare route or internet connection is unavailable.

## Create a Restricted ntfy Identity

Create a dedicated regular user. The command prompts for a password; DIUN will use a token rather than storing that password:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p ntfy \
  -f ntfy/docker-compose.yml \
  exec ntfy ntfy user add diun
```

Grant the user write-only access to the update topic:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p ntfy \
  -f ntfy/docker-compose.yml \
  exec ntfy ntfy access diun updates write-only
```

Create a non-expiring access token:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p ntfy \
  -f ntfy/docker-compose.yml \
  exec ntfy ntfy token add --label="DIUN image updates" diun
```

Add the returned token to the repository root `.env`:

```dotenv
DIUN_NTFY_TOKEN=tk_replace_with_the_returned_token
DIUN_NTFY_TOPIC=updates
```

If you change `DIUN_NTFY_TOPIC`, grant the `diun` user write-only access to that exact topic as well. Sign in to ntfy as your administrator and subscribe to the topic on each device that should receive image-update notifications.

## Start and Test

From the repository root:

```bash
make up STACK=diun
make ps STACK=diun
make logs STACK=diun SERVICE=diun TAIL=200
```

Send a test notification through DIUN's configured ntfy notifier:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p diun \
  -f diun/docker-compose.yml \
  exec diun diun notif test
```

The first image scan establishes the local baseline and intentionally does not notify for every existing image. Later digest or tag changes produce notifications.

## What DIUN Watches

`DIUN_PROVIDERS_DOCKER_WATCHBYDEFAULT=true` monitors the image tag of every running container. This covers moving tags such as `latest`, `stable`, and `2`.

An exact image tag such as `v2.28.0` normally changes only if its digest is rebuilt. The pinned services therefore add narrow `diun.watch_repo` labels:

| Service | Accepted release tags |
| --- | --- |
| DIUN | `x.y.z` |
| ntfy | `v2.x.y` |
| AdGuard Home | `v0.x.y` |
| Portainer | `2.x.y` |
| Home Assistant | `YYYY.x.y` |

Each rule uses semantic-version sorting and `diun.max_tags=1`, so DIUN tracks only the newest matching release. Pre-release, development, architecture-specific, and unrelated tags are excluded by the regular expressions.

Do not enable `diun.watch_repo=true` globally. Repository mode lists tags and can create unnecessary registry traffic or noisy notifications when it is not tightly filtered.

## Security Model

DIUN does not receive the Docker socket directly. Its private `docker_proxy` network contains a dedicated LinuxServer socket proxy that allows only:

- Docker ping and API-version discovery
- read-only container listing and inspection
- no POST requests, events, images, networks, volumes, secrets, or other Docker API groups

The socket proxy publishes no host port and is not attached to the shared `web` network. DIUN is attached to `web` only so it can reach ntfy and container registries.

## Applying an Update

A DIUN notification means that an image changed; it does not mean the release is automatically safe. Review the upstream release notes, then update the appropriate stack:

```bash
make update STACK=<stack>
make ps STACK=<stack>
make logs STACK=<stack> TAIL=200
```

For an exact-version service, first change the image tag in its Compose file, then run `make update STACK=<stack>`. For a moving tag such as `latest`, the existing Compose file can be updated directly with the command above.

DIUN stores its manifest baseline in `diun/data/diun.db`. The directory is ignored by Git and should be preserved across container recreation.
