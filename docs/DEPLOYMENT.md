# AI Secretary - Deployment & CI/CD Guide

This document outlines the Continuous Integration and Continuous Deployment (CI/CD) strategy for the AI Secretary project, including environment setup and GitHub Actions pipelines.

## 🚀 Branching Strategy

The project uses a simple Git flow:
- `dev` branch: All active development and feature implementations happen here. Local testing runs on this branch.
- `master` branch: The production branch. 
  **Deploying to Production:** To deploy the application, developers merge `dev` into `master` via pull request (or direct merge). This triggers the automated deployment pipeline.
  
## 🔀 Automated Pipeline (GitHub Actions)
The deployment is fully automated via GitHub Actions (`.github/workflows/deploy.yml`).

### Workflow Steps:
1. **Trigger:** Push to `master` (or `main`, `prod`).
2. **Checkout:** Clones the repository to the action runner.
3. **Copy Files (SCP):** Uses SSH to securely copy the entire repository to `/opt/ai_secretary` on the VPS.
4. **Environment Generation:** Echoes all configured GitHub Secrets into a production `.env` file on the server.
5. **Docker Compose:** Pulls base images and runs `docker compose up -d --build` to automatically provision the PostgreSQL, Redis, Node.js App, and Caddy (HTTPS) containers.
6. **Database Migrations:** Automatically runs `yarn prisma migrate deploy` inside the Node container to ensure the database schema matches the deployed code.

## 🔐 Required GitHub Secrets
To allow the deployment pipeline to function, the following repositories secrets MUST be configured in your GitHub Repository settings:

### Infrastructure Secrets
- `HOST`: VPS IP Address (e.g. `8.8.8.8`)
- `USERNAME`: SSH Username (e.g. `root`)
- `SSH_PRIVATE_KEY`: Private SSH Key to connect to the VPS.

### App Configuration Secrets
- `DOMAIN_NAME`: Custom domain used for HTTPS routing (e.g. `ai.kir.site`).
- `TIMEZONE`: e.g. `Europe/Kiev`
- `MORNING_CRON` / `EVENING_CRON`: Cron schedule timing strings.
- `DAILY_CAPACITY_MINUTES`: E.g., `360` (6 hours).

### Database Secrets
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

### External API Secrets
- `SYNC_API_KEY`: Custom static string to protect the manual sync endpoint.
- `OPENAI_API_KEY`: Key for GPT models.
- `OPENAI_BASE_URL`: (Optional) specifically for custom proxies like Abacus.
- `TELEGRAM_BOT_TOKEN`: The bot Token.
- `TELEGRAM_CHAT_ID`: Your personal user ID on Telegram.
- `JIRA_API_TOKEN` & `JIRA_ACCOUNT_ID` & `JIRA_EMAIL` & `JIRA_DOMAIN`: For fetching Jira cards.
- `TICKTICK_CLIENT_ID` & `TICKTICK_CLIENT_SECRET`: For TickTick OAuth flow.

## 🛑 Server Maintenance & Debugging

The application runs entirely inside Docker Compose on the VPS. If you ever need to manually restart or debug the app via SSH:

```bash
cd /opt/ai_secretary

# View live application logs
docker compose logs -f app

# View Caddy server (HTTPS routing) logs
docker compose logs -f caddy

# Restart the entire stack
docker compose restart

# Manually trigger a database migration (if CI/CD failed)
docker compose exec app yarn prisma migrate deploy
```
