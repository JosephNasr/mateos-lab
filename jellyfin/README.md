# Jellyfin

Full media stack:

- Jellyfin for streaming
- Seerr for media requests
- Prowlarr for indexer management
- Sonarr for TV automation
- Radarr for movie automation
- Bazarr for automatic subtitles
- qBittorrent for downloads

## Host Setup

Create the storage and app config folders on the Docker host:

```bash
sudo mkdir -p /srv/media/{movies,tv} /srv/downloads/{complete,incomplete} /srv/appdata/{qbittorrent,prowlarr,sonarr,radarr,bazarr,seerr,jellyfin}
sudo chown -R "$(id -u):$(id -g)" /srv/media /srv/downloads /srv/appdata
```

Copy the example environment file to the repo-level `.env` used by the root `makefile`, then fill in your host values:

```bash
cp .env.example .env
```

Required Jellyfin stack values:

- `PI_IP`
- `JELLYFIN_PUBLIC_URL` if exposing Jellyfin publicly
- `APPDATA_DIR`
- `STORAGE_ROOT` (default: `/srv`; common parent of media and downloads for hardlinks)
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
- Seerr: `http://PI_IP:5055`
- Prowlarr: `http://PI_IP:9696`
- Sonarr: `http://PI_IP:8989`
- Radarr: `http://PI_IP:7878`
- Bazarr: `http://PI_IP:6767`
- qBittorrent: `http://PI_IP:8080`

## Cloudflare Tunnel Routes

The `jellyfin` and `seerr` containers also join the external `web` Docker network so the existing `cloudflared` container can reach them by service name.

In the Cloudflare Zero Trust dashboard, add these Published Application routes to the same tunnel used by n8n:

- `requests.example.com` -> `http://seerr:5055`
- `watch.example.com` -> `http://jellyfin:8096`

Replace `example.com` with your real Cloudflare domain, and set `JELLYFIN_PUBLIC_URL=https://watch.example.com` in the repo-level `.env`.

Seerr should continue to use internal URLs for app integrations:

- Jellyfin: `http://jellyfin:8096`
- Sonarr: `http://sonarr:8989`
- Radarr: `http://radarr:7878`

## First-Run Configuration

Jellyfin:

- Add Movies library: `/data/movies`
- Add TV Shows library: `/data/tv`

qBittorrent:

- Set the default save path to `/downloads/complete`
- Set the incomplete downloads path to `/downloads/incomplete`
- Keep DHT, PeX, and Local Peer Discovery enabled for magnet links

Sonarr:

- Root folder: `/tv`
- Download client: qBittorrent at `http://qbittorrent:8080`
- Category: `tv`

Radarr:

- Root folder: `/movies`
- Download client: qBittorrent at `http://qbittorrent:8080`
- Category: `movies`

Bazarr:

- Add Sonarr at `http://sonarr:8989` and Radarr at `http://radarr:7878`, using each application's API key.
- In **Settings > Languages**, add `Arabic` as an enabled subtitle language, then create an `Arabic` language profile with normal subtitles (not forced or hearing-impaired unless wanted).
- Assign that profile as the default for both series and movies.
- In **Settings > Providers**, add subtitle-provider accounts (OpenSubtitles is a common starting point). Use more than one provider if you want better coverage.
- When Sonarr/Radarr have been moved to the `/data/media/...` paths below, configure Bazarr against those same paths; do not add Bazarr path mappings. Its Compose mounts already match them.

### Download Arabic Subtitles for Existing Media

After Bazarr is connected to Sonarr and Radarr, backfill the current library as follows:

1. Open **Settings > Languages**. Add `Arabic` to the enabled subtitle languages, then create and save an `Arabic` language profile with normal subtitles. Only enable forced or hearing-impaired subtitles if those are specifically wanted.
2. Open **Settings > Providers**. Add and test at least one subtitle-provider account. Add another provider if Arabic coverage is sparse instead of lowering the minimum score immediately.
3. Open **Series > Mass Edit**, select every series, assign the `Arabic` language profile, and save.
4. Open **Movies > Mass Edit**, select every movie, assign the same profile, and save.
5. From the Series and Movies pages, run Bazarr's search for missing/wanted subtitles. Bazarr queues searches for media without an Arabic subtitle and saves matches alongside the video files.

Keep the Arabic profile as the default for series and movies so future Sonarr/Radarr imports are searched automatically.

Jellyfin:

- In each user's playback/subtitle preferences, set the preferred subtitle language to `Arabic`. Jellyfin will automatically select Arabic when Bazarr has downloaded it.

## Hardlink Imports (Sonarr and Radarr)

Sonarr and Radarr need their download and library paths beneath the same container mount to create hardlinks. The Compose file provides that common mount as `/data` (host `${STORAGE_ROOT:-/srv}`). The existing `/tv`, `/movies`, and `/downloads` paths remain temporarily for compatibility, but imports will continue to copy until you make the following application changes.

In Sonarr:

- Keep **Settings > Media Management > Use Hardlinks instead of Copy** enabled.
- Change the root folder to `/data/media/tv`.
- In **Settings > Download Clients**, add a Remote Path Mapping for qBittorrent: remote path `/downloads`, local path `/data/downloads`.

In Radarr:

- Keep **Settings > Media Management > Use Hardlinks instead of Copy** enabled.
- Change the root folder to `/data/media/movies`.
- Add the same qBittorrent Remote Path Mapping: remote path `/downloads`, local path `/data/downloads`.

Do this before importing new downloads. Existing copies stay separate until you remove the corresponding completed torrent files after their seeding period; do not remove media-library files from the filesystem manually.

Bazarr has the same `/data`, `/tv`, and `/movies` mounts as Sonarr and Radarr. It writes external subtitle files alongside the media; Jellyfin discovers them on its scheduled scan or a manual library scan.

Prowlarr:

- Add Sonarr app: `http://sonarr:8989`
- Add Radarr app: `http://radarr:7878`
- Use the API keys from each app's settings page.
- For Cloudflare-protected indexers (e.g. 1337x, EZTV), add FlareSolverr as an indexer proxy: **Settings > Indexer Proxies > Add > FlareSolverr**
  - Host: `http://flaresolverr:8191/`
  - Tags: give it a tag, e.g. `flaresolverr`
  - Test, then Save
  - For each Cloudflare-protected indexer, add that same tag in the indexer's own Tags field, then Test. A blank tag on the proxy does not reliably apply it to indexers — always set one explicitly on both sides.

Seerr:

- Jellyfin server: `http://jellyfin:8096`
- Sonarr server: `http://sonarr:8989`
- Radarr server: `http://radarr:7878`

## qBittorrent Metadata Troubleshooting

If manually added magnets stay stuck at `Downloading metadata`, first make sure the container and persisted qBittorrent settings agree on the torrent port:

```bash
docker compose --env-file /home/zeezoux/containers/.env -p jellyfin -f jellyfin/docker-compose.yml up -d --force-recreate qbittorrent
docker exec qbittorrent sh -lc 'grep -E "Session\\\\Port|DHT|PeX|LSD|Proxy" /config/qBittorrent/qBittorrent.conf || true'
```

In qBittorrent's Web UI, check:

- Tools > Options > Connection > Listening Port is `6881`, or your `QBITTORRENT_PORT` value
- Tools > Options > BitTorrent has DHT, PeX, and Local Peer Discovery enabled
- Tools > Options > Connection has no proxy configured unless you intentionally use one
- The host firewall allows inbound TCP and UDP on `QBITTORRENT_PORT`

Router port forwarding is not strictly required to download, but forwarding TCP and UDP `QBITTORRENT_PORT` to the Docker host makes qBittorrent an active peer and usually fixes weak peer discovery on private or sparse swarms.

## Optional Hardware Transcoding

Hardware transcoding is disabled by default. On a supported Linux host, enable the commented `/dev/dri` device mapping in `jellyfin/docker-compose.yml`, then configure hardware acceleration from Jellyfin's admin dashboard.