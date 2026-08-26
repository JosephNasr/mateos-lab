# Home Assistant

This directory contains the Home Assistant deployment and its portable
configuration. Runtime data, credentials, caches, and logs are intentionally
excluded from Git.

## Custom integrations

The device integrations below are vendored so that a fresh clone has the code
Home Assistant needs to load them. Update them deliberately, review the
changes, and commit the new source and version together.

| Integration | Source | Pinned version |
| --- | --- | --- |
| Govee | <https://github.com/LaggAt/hacs-govee> | 2025.1.1 |
| Meross Cloud IoT | <https://github.com/albertogeniola/meross-homeassistant> | 1.3.12 |
| Sonoff | <https://github.com/AlexxIT/SonoffLAN> | 3.12.2 |

HACS is not vendored: it is an integration manager rather than a runtime
dependency for the integrations above. The current installation was HACS
2.0.5. To add it after cloning, follow the official installer instructions:

```bash
wget -O - https://get.hacs.xyz | bash -
```

Restart Home Assistant after installing HACS, then complete its setup in the
Home Assistant UI. Its credentials and configuration live in ignored runtime
storage and must be configured again on a new host.
