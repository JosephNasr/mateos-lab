# Jellyfin

## Purpose

This directory is the media stack. Today it actively runs Jellyfin for streaming, but the compose file also captures the larger media-management picture you intend to use in the homelab: requests, indexers, download automation, torrenting, and optional SMB sharing.

## Active Services

| Service | Image | Why it exists |
| --- | --- | --- |
| `jellyfin` | `lscr.io/linuxserver/jellyfin:latest` | Streams the media library to clients such as Google TV. |

## Runtime Shape

- Compose file: `jellyfin/docker-compose.yml`
- Docker Compose project name: `jellyfin`
- Active network: bridge network `plex_net`
- Published port: `8096:8096`
- Environment source for Docker deployment: `/home/zeezoux/containers/.env`
- Important variables:
  - `PI_IP`
  - `JELLYFIN_LIBRARY`
  - `JELLYFIN_TV`
  - `JELLYFIN_MOVIES`
  - `PUID`
  - `PGID`
  - `UMASK`
- Main mounts:
  - `${JELLYFIN_LIBRARY}:/config`
  - `${JELLYFIN_TV}:/data/tv`
  - `${JELLYFIN_MOVIES}:/data/movies`

## Whole Media Stack Picture

These services are currently commented out, but the images and roles are already documented in the compose file:

| Service | Image | Role |
| --- | --- | --- |
| `jellyseerr` | `fallenbagel/jellyseerr:latest` | Request portal for asking the media stack to fetch content. |
| `prowlarr` | `lscr.io/linuxserver/prowlarr:latest` | Central indexer manager. |
| `sonarr` | `lscr.io/linuxserver/sonarr:latest` | TV download automation. |
| `radarr` | `lscr.io/linuxserver/radarr:latest` | Movie download automation. |
| `qbittorrent` | `lscr.io/linuxserver/qbittorrent:latest` | Torrent client used by the automation services. |
| `samba` | `dperson/samba:latest` | Optional SMB share for browsing media directly over the LAN. |

Those services are not deployed until they are uncommented and brought up.

## How To Redeploy Changes

If you changed `jellyfin/docker-compose.yml` or the root `.env`, redeploy the stack with:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p jellyfin \
  -f /home/zeezoux/containers/jellyfin/docker-compose.yml \
  up -d
```

If you want the newest upstream Jellyfin image first:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p jellyfin \
  -f /home/zeezoux/containers/jellyfin/docker-compose.yml \
  pull

docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p jellyfin \
  -f /home/zeezoux/containers/jellyfin/docker-compose.yml \
  up -d
```

If you prefer to reconcile everything from the root instead:

```bash
cd /home/zeezoux/containers
make up
```
