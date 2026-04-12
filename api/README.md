# API

Small Express API for YNAB automation, gold portfolio calculations, and weather helpers.

## Prerequisites

- Node.js `>=14` (from `package.json`)
- npm

## Install

```bash
npm install
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Optional port override:

```bash
PORT=5000 npm start
```

## Endpoints

System:

- `GET /health`
- `GET /device`

YNAB:

- `POST /ynab/gold-stats-update`
- `GET /ynab/golden-update`
- `POST /ynab/golden-update`
- `GET /ynab/golden-update-single`
- `POST /ynab/golden-update-single`

Weather:

- `GET /weather`

## Required YNAB Headers

For protected `/ynab/*` endpoints:

- `authorization`
- `budget`
- `account-j` and `account-n` (dual-account endpoints)
- `account` (single-account endpoints)

## OpenAPI Spec

- `docs/openapi/ynab-api.yaml`
