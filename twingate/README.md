# Twingate

This stack runs a Twingate Connector, which provides Twingate users with private access to the resources configured in the Twingate Admin Console.

## Configure

1. In the Twingate Admin Console, create a Remote Network and Connector for this host.
2. Copy the Connector's network name, access token, and refresh token into the repo-level `.env` file. The root `makefile` loads this file for every stack.
3. Set `TWINGATE_LABEL_HOSTNAME` to a descriptive label for this Connector, such as `homelab`.

Required values:

- `TWINGATE_NETWORK`
- `TWINGATE_ACCESS_TOKEN`
- `TWINGATE_REFRESH_TOKEN`
- `TWINGATE_LABEL_HOSTNAME`

Use `twingate/.env.example` or the Twingate section of the root `.env.example` as the template. Do not commit real access or refresh tokens.

## Start The Stack

From the repository root:

```bash
make pull STACK=twingate
make up STACK=twingate
make ps STACK=twingate
```

Check its connection status in the Twingate Admin Console. For local troubleshooting, stream the Connector logs:

```bash
make logs STACK=twingate SERVICE=twingate TAIL=200
```
