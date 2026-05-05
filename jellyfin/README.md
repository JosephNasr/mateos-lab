# Jellyfin

Full LAN-only media stack:

- Jellyfin for streaming
- Jellyseerr for media requests
- Prowlarr for indexer management
- Sonarr for TV automation
- Radarr for movie automation
- qBittorrent for downloads

## Host Setup

Create the storage and app config folders on the Docker host:

```bash
sudo mkdir -p /srv/media/{movies,tv} /srv/downloads/{complete,incomplete} /srv/appdata/{qbittorrent,prowlarr,sonarr,radarr,jellyseerr,jellyfin}
sudo chown -R "$(id -u):$(id -g)" /srv/media /srv/downloads /srv/appdata
```

Copy the example environment file to the repo-level `.env` used by the root `makefile`, then fill in your host values:

```bash
cp .env.example .env
```

Required Jellyfin stack values:

- `PI_IP`
- `APPDATA_DIR`
- `MEDIA_ROOT`
- `TV_DIR`
- `MOVIES_DIR`
- `DOWNLOADS_DIR`
- `PUID`
- `PGID`
- `UMASK`

## Start The Stack

From the repo root:

```bash
make pull STACK=jellyfin
make up STACK=jellyfin
make ps STACK=jellyfin
```

## Web UIs

- Jellyfin: `http://PI_IP:8096`
- Jellyseerr: `http://PI_IP:5055`
- Prowlarr: `http://PI_IP:9696`
- Sonarr: `http://PI_IP:8989`
- Radarr: `http://PI_IP:7878`
- qBittorrent: `http://PI_IP:8080`

## First-Run Configuration

Jellyfin:

- Add Movies library: `/data/movies`
- Add TV Shows library: `/data/tv`

qBittorrent:

- Set the default save path to `/downloads/complete`
- Set the incomplete downloads path to `/downloads/incomplete`

Sonarr:

- Root folder: `/tv`
- Download client: qBittorrent at `http://qbittorrent:8080`
- Category: `tv`

Radarr:

- Root folder: `/movies`
- Download client: qBittorrent at `http://qbittorrent:8080`
- Category: `movies`

Prowlarr:

- Add Sonarr app: `http://sonarr:8989`
- Add Radarr app: `http://radarr:7878`
- Use the API keys from each app's settings page.

Jellyseerr:

- Jellyfin server: `http://jellyfin:8096`
- Sonarr server: `http://sonarr:8989`
- Radarr server: `http://radarr:7878`

## Optional Hardware Transcoding

Hardware transcoding is disabled by default. On a supported Linux host, enable the commented `/dev/dri` device mapping in `jellyfin/docker-compose.yml`, then configure hardware acceleration from Jellyfin's admin dashboard.
