# n8n

## DNS and deployment

n8n uses AdGuard Home at `192.168.18.2` for DNS.  This keeps container DNS
queries subject to the same filtering and Quad9-backed upstream resolution as
the rest of the home network.

The n8n Compose file reads its settings from the repository-root `.env` file.
Run Compose from the repository root so those values are supplied:

```bash
cd ~/containers
docker compose --env-file .env -f n8n/docker-compose.yml up -d
```

This is required for `TIMEZONE`, `N8N_HOST`, `N8N_PUBLIC_URL`, and
`N8N_WEBHOOKS_URL`.
