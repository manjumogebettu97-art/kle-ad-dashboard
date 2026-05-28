# Unified Ad Analytics Dashboard

A full-stack analytics dashboard for **LinkedIn Ads** and **Google Ads** that ingests CSV exports (no API integration required) and presents per-period KPIs, campaign breakdowns, and geo performance — with role-based access control (Admin / User).

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, Chart.js, react-router-dom |
| Backend    | Node.js, Express                    |
| Database   | SQLite (via better-sqlite3)         |
| Auth       | JWT + bcrypt                        |

---

## Project Structure

```
KLE ad Dashboard/
├── backend/
│   ├── src/
│   │   ├── db/           # schema + seed
│   │   ├── import/       # CSV report importer  (npm run import)
│   │   ├── middleware/   # JWT auth + requireAdmin
│   │   ├── routes/       # auth, dashboard, settings
│   │   └── server.js
│   ├── data/
│   │   ├── dashboard.db  # SQLite (auto-created)
│   │   └── imports/      # drop CSV reports here, organized by folder
│   │       └── google-display/
│   │           ├── Campaign report.csv
│   │           └── Location report.csv
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/   # Navbar, KpiCard, CampaignTable, ProtectedRoute
    │   ├── context/      # AuthContext
    │   ├── pages/        # Login, Dashboard, Locations, Settings
    │   ├── services/     # axios API client
    │   ├── utils/        # format helpers
    │   └── App.js
    └── package.json
```

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in JWT_SECRET at minimum
npm run seed                # creates DB + demo users
npm run import              # ingests CSV reports from data/imports/
npm run dev                 # starts on http://localhost:5001
```

### 2. Frontend

```bash
cd frontend
npm install
npm start                   # starts on http://localhost:3000
```

### 3. Login

`npm run seed` creates local users. Use the generated credentials printed by the seed script, or set `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` before running it.

---

## Importing Reports

This dashboard reads CSV exports from Google Ads (and LinkedIn Campaign Manager when available). Reports are **period-aggregate** — one summary per export, no daily breakdown required.

### Folder convention

```
backend/data/imports/<platform>-<sub_platform>/<any>.csv
```

Examples:
- `google-display/Campaign report.csv` + `Location report.csv`
- `google-search/Campaign report.csv`
- `linkedin-sponsored/Campaign report.csv`

The folder name encodes the platform + sub-platform; the importer infers both from the path. All files in one folder are assumed to share the same date range (which is read from line 2 of each Google Ads CSV).

### Run the importer

```bash
cd backend
npm run import
```

Output:
```
▶ google-display/
  ✓ Campaign report.csv: imported 1 campaign row(s)
  ✓ Location report.csv: imported 257 location row(s)

Summary:
  google/display  [February 1, 2026 - April 30, 2026]  campaigns=1  locations=257
```

Re-running is safe — rows upsert by `(period, campaign_name)` or `(period, location)`.

### Supported reports

| Report type      | Detected from        | Stored in          |
|------------------|----------------------|--------------------|
| Campaign report  | title or `Campaign` column | `campaign_metrics` |
| Location report  | title or `Location` column | `location_metrics` |

The parser handles Google Ads' default export format (UTF-16 LE BOM, tab-separated, two title rows, quoted comma-thousands numbers, "%" suffixed percentages, "--" placeholders).

---

## Features

### Dashboard
- **Period selector** — switch between imported reporting periods / platforms
- **KPI summary cards** — Impressions · Clicks · Cost · Conversions (CTR, CPC, CPM in subtitles)
- **Per-platform breakdown** (shown when multiple platforms are loaded)
- **Campaign table** — sortable per-campaign breakdown with CPC, CPM, Viewable CTR

### Geo Performance
- **Top-15 horizontal bar chart** — sort by any metric (impr, clicks, cost, CTR, conv)
- **Searchable, sortable table** of all locations
- **Aggregate stats** — total locations, impr, clicks, cost

### Settings (Admin only)
- Account display names for LinkedIn & Google
- User management — view all users, add new users, delete users
- Documentation of the import flow

### Security
- JWT authentication (8-hour expiry)
- bcrypt password hashing (10 rounds)
- Role-based route guarding (frontend + backend)
- `helmet` security headers
- Rate limiting on auth endpoints (20 req / 15 min)
- CORS restricted to frontend origin

---

## API Endpoints

All require `Authorization: Bearer <jwt>`.

| Method | Path                            | Returns                              |
|--------|---------------------------------|--------------------------------------|
| GET    | `/api/dashboard/periods`        | List of imported periods             |
| GET    | `/api/dashboard/summary?period=<id>` | KPI totals + per-platform rows  |
| GET    | `/api/dashboard/campaigns?period=<id>&platform=<google\|linkedin>` | Campaign rows |
| GET    | `/api/dashboard/locations?period=<id>&sortBy=<col>&order=<asc\|desc>&limit=<n>` | Location rows + totals |
| GET    | `/api/dashboard/ads?period=<id>&sortBy=<col>&order=<asc|desc>` | Ad creative rows |
| GET    | `/api/dashboard/placements?period=<id>&sortBy=<col>&order=<asc|desc>` | Placement rows |
| GET    | `/api/dashboard/highlights?period=<id>` | Dashboard highlights |
| GET    | `/api/dashboard/daily?period=<id>` | Daily chart rows |
| GET    | `/api/dashboard/companies?period=<id>` | Company rows |
| GET    | `/api/settings`                 | Display-name settings                |
| PUT    | `/api/settings`                 | Update settings (admin)              |
| GET    | `/api/settings/users`           | List users (admin)                   |
| DELETE | `/api/settings/users/:id`       | Delete user (admin)                  |
| POST   | `/api/auth/login`               | Sets HttpOnly auth cookie            |
| POST   | `/api/auth/logout`              | Clears auth cookie                   |
| POST   | `/api/auth/register`            | Create user (admin)                  |
| GET    | `/api/auth/me`                  | Current authenticated user           |
| GET    | `/api/health`                   | Health check                         |

---

## Environment Variables

See `backend/.env.example` for the full list. Only `JWT_SECRET` is required.

---

## Deployment

The app can run as one Node service in production: Express serves `/api`, `/assets`, and the built React app from `frontend/build`.

Render blueprint deployment is configured in `render.yaml`.

Required production settings:
- `JWT_SECRET` — generated automatically by the blueprint
- `SEED_ADMIN_PASSWORD` — set this before the first deploy so the admin login is known
- `DB_DIR=/var/data` — uses the persistent disk from `render.yaml`

Production commands:

```bash
npm install
npm run build
npm run start:deploy
```

`start:deploy` seeds users if missing, imports CSV reports into SQLite, then starts the backend. Re-running the importer is safe.
