# Kopia Backup Server

This stack runs the Kopia web UI and backs up the homelab's Compose projects, application data, and n8n Docker volume.

## Sources Available to Kopia

| Source in Kopia | Host source | Access |
| --- | --- | --- |
| `/sources/containers` | `/home/zeezoux/containers` | Read-only |
| `/sources/appdata` | `/srv/appdata` | Read-only |
| `/sources/n8n` | External Docker volume `n8n_n8n_data` | Read-only |

The `n8n_n8n_data` volume must exist before starting this stack. It is created by the n8n Compose project.

## Start and Access

The root `.env` must define these values before startup:

```dotenv
TIMEZONE=Asia/Beirut
KOPIA_REPOSITORY_PASSWORD=choose-a-strong-repository-password
KOPIA_UI_USERNAME=kopia
KOPIA_UI_PASSWORD=choose-a-strong-ui-password
```

Start the stack from the repository root:

```bash
make up STACK=kopia
```

Open `https://<host-ip>:51515` from the LAN and sign in with `KOPIA_UI_USERNAME` and `KOPIA_UI_PASSWORD`. The server uses the local certificate at `config/server.cert`, so a browser warning is expected unless the certificate is trusted.

In the UI, connect to or create the encrypted repository, using `KOPIA_REPOSITORY_PASSWORD`, then configure backup policies for the required paths above. Repository destination settings depend on the selected storage provider and are stored locally by Kopia.

## Verify Backups and Restores

After creating a policy, confirm it produces a successful snapshot and periodically test a restore:

1. Restore a non-critical file to `kopia/restore/` from the UI.
2. Check that its content is usable.
3. Remove the test restore when finished; `kopia/restore/` is ignored by Git.

Review server logs when diagnosing a failed job:

```bash
make logs STACK=kopia SERVICE=kopia TAIL=200
```

## Local State and Git

The Compose definition is portable and should be committed. The following directories are deliberately ignored because they hold credentials, private keys, caches, logs, repository metadata, or restored files:

- `config/`
- `cache/`
- `logs/`
- `rclone/`
- `restore/`

Do not commit `.env`, `rclone/rclone.conf`, `config/repository.config`, `config/server.key`, or restored data. Retain the repository password and storage-provider credentials in a secure password manager: without them, an encrypted repository may be unrecoverable.
