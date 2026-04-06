# Hoi-Yong Finance — Demo Dashboard

Sales revenue dashboard for Hoi-Yong Finance (fruit/produce distributor, Malaysia).

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Credentials from Bitwarden (shared by Jason)

## Setup (one-time)

1. **Clone this branch:**

   ```bash
   git clone -b demo/docker-handoff https://github.com/jasonpaul-aqreight/HY-Finance-Demo.git
   cd HY-Finance-Demo
   ```

2. **Create your `.env` file:**

   ```bash
   cp .env.example .env
   ```

3. **Fill in credentials** from Bitwarden — replace the `USER`, `PASSWORD`, and `HOST` placeholders in both `AUTOCOUNT_DATABASE_URL` and `RDS_DATABASE_URL`.

## Start

```bash
docker compose up --build
```

This will:
- Start PostgreSQL and create the schema automatically
- Start the sync service, which runs an **initial data sync** (~2-3 min)
- Start the dashboard on **http://localhost:3000**

> Wait 2-3 minutes for the initial sync to finish, then refresh the dashboard.
> You can check sync progress at **http://localhost:4000/api/sync/status**

## Stop

```bash
docker compose down
```

Containers stop. Data is preserved in the Docker volume.

## Clean (reset everything)

```bash
docker compose down -v
```

This removes containers **and** the database volume. Next `docker compose up --build` will start fresh (empty DB + full re-sync).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Dashboard shows empty charts | Wait for initial sync to finish, then refresh |
| Sync failed on startup | Check `.env` credentials are correct. View logs: `docker compose logs sync` |
| Port 3000 already in use | Stop whatever is using it, or change the port in `docker-compose.yml` |
| Drill-down shows no data | `RDS_DATABASE_URL` may be missing — this is optional |
