# Hosting

This bot is ready for Node.js hosting services such as Render, Railway, Fly.io, or a VPS.

## Commands

Install command:

```sh
npm install
```

Start command:

```sh
npm start
```

Health check path:

```text
/health
```

Dashboard path:

```text
/Dashboard?StaffOnly
```

## Required Environment Variables

Set these in your host dashboard. Do not upload your local `.env` publicly.

```text
DISCORD_TOKEN=
DISCORD_ID=
GUILD_IDS=
ADMIN_ROLE_ID=
MODERATOR_ROLE_ID=
SERVER_ADMIN_ROLE_ID=
LOG_CHANNEL_ID=
SESSION_PING_ROLE_ID=
ERLC_SERVER_KEY=
PROMO_ROLES=
MAX_WARNINGS=10
MUTE_DURATION=15
DASHBOARD_PASSWORD=HsrpppStaffTeam
```

Most hosts set `PORT` automatically. If your host asks for a port, use:

```text
PORT=3000
```

## Render Setup

1. Push this folder to a GitHub repository.
2. Create a new Render Web Service from the repository.
3. Use `npm install` as the build command.
4. Use `npm start` as the start command.
5. Set the health check path to `/health`.
6. Add the environment variables above.

After deploy, your dashboard URL will look like:

```text
https://your-service-name.onrender.com/Dashboard?StaffOnly
```
