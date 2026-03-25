# Home Assistant

## Purpose

This stack is the homelab's local automation hub. `homeassistant` handles device discovery, dashboards, automations, and integrations on the LAN, while `mosquitto` provides an MQTT broker that future local-first services can use for messaging.

## Active Services

| Service | Image | Why it exists |
| --- | --- | --- |
| `homeassistant` | `ghcr.io/home-assistant/home-assistant:stable` | Main automation platform with host networking and broad hardware access. |
| `mosquitto` | `eclipse-mosquitto:2` | MQTT broker for integrations such as Zigbee2MQTT, ESPHome, and other local automation components. |

## Runtime Shape

- Compose file: `home_assistant/docker-compose.yml`
- Docker Compose project name: `home_assistant`
- `homeassistant` uses `network_mode: host` for LAN discovery protocols such as mDNS, SSDP, and UPnP
- `homeassistant` runs `privileged: true`
- `homeassistant` config volume: `home_assistant/ha/config:/config`
- `mosquitto` config/data/log volumes:
  - `home_assistant/mosquitto/config:/mosquitto/config`
  - `home_assistant/mosquitto/data:/mosquitto/data`
  - `home_assistant/mosquitto/log:/mosquitto/log`
- Exposed MQTT ports:
  - `1883` for MQTT
  - `9001` for WebSocket MQTT
- Environment source for Docker deployment: `/home/zeezoux/containers/.env`
- Important config files:
  - `home_assistant/ha/config/configuration.yaml`
  - `home_assistant/ha/config/automations.yaml`
  - `home_assistant/ha/config/scripts.yaml`
  - `home_assistant/ha/config/scenes.yaml`
  - `home_assistant/mosquitto/config/mosquitto.conf`

## How To Redeploy Changes

If you changed `home_assistant/docker-compose.yml` or values in `/home/zeezoux/containers/.env`, redeploy the whole stack with:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p home_assistant \
  -f /home/zeezoux/containers/home_assistant/docker-compose.yml \
  up -d
```

If you changed mounted Home Assistant YAML files and want the container restarted cleanly:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p home_assistant \
  -f /home/zeezoux/containers/home_assistant/docker-compose.yml \
  restart homeassistant
```

If you changed Mosquitto config and want the broker restarted:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p home_assistant \
  -f /home/zeezoux/containers/home_assistant/docker-compose.yml \
  restart mosquitto
```

If you want newer upstream images first:

```bash
docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p home_assistant \
  -f /home/zeezoux/containers/home_assistant/docker-compose.yml \
  pull

docker compose \
  --env-file /home/zeezoux/containers/.env \
  -p home_assistant \
  -f /home/zeezoux/containers/home_assistant/docker-compose.yml \
  up -d
```

For a whole-homelab redeploy:

```bash
cd /home/zeezoux/containers
make up
```

## Future Services

The compose file already includes commented templates for `zigbee2mqtt` and `matter-server`. They are not deployed today, but the current stack layout is already prepared for them.
