# Portainer

## Purpose

This stack runs Portainer CE as the Docker management UI for the homelab. It is the browser-based view into running containers, images, volumes, networks, and stacks on this host.

## Active Services

| Service | Image | Why it exists |
| --- | --- | --- |
| `portainer` | `portainer/portainer-ce:lts` | Web UI for operating the local Docker daemon. |

## Runtime Shape

- Compose file: `portainer/docker-compose.yml`
- Docker Compose project name: `portainer`
- Network: external `web`
- Published port: `9443:9443`
- Persistent data: `portainer/data:/data`
- Docker socket mount: `/var/run/docker.sock:/var/run/docker.sock`
- Environment source for Docker deployment: `/home/zeezoux/containers/.env`

Because this is an image-based service, there is no local build step in this directory.

## How To Redeploy Changes

If you changed `portainer/docker-compose.yml`, redeploy the stack with:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p portainer \
  -f /home/zeezoux/containers/portainer/docker-compose.yml \
  up -d
```

If you want the latest upstream Portainer image first:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p portainer \
  -f /home/zeezoux/containers/portainer/docker-compose.yml \
  pull

docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p portainer \
  -f /home/zeezoux/containers/portainer/docker-compose.yml \
  up -d
```

If you prefer to redeploy everything from the root:

```bash
cd /home/zeezoux/containers
make up
```
