# Plan for Fixing Cron Jobs and Telegram Bot

The issues preventing the Telegram bot from responding and the cron tasks from running properly have been identified.

## User Action Required

> [!CAUTION]
> The Telegram Bot is failing to start because the API returned a **401 Unauthorized** error. 
> This means the `TELEGRAM_BOT_TOKEN` in `nodejs_space/.env` is either invalid, expired, or has a typo.
> **Action:** Please verify and update the `TELEGRAM_BOT_TOKEN` in your `.env` file with a valid token from BotFather.

## Proposed Changes

### 1. Refactor Cron Scheduler
**File:** `nodejs_space/src/transport/cron/scheduler.controller.ts`
- **Current Issue:** The cron schedule times are hardcoded to `0 10 * * *` and `0 21 * * *` instead of using the environment variables defined in `docker-compose.yml`. Also, it accesses a private property of `PlanningOrchestrator` hackily (`this.planningOrchestrator['telegramService']`).
- **Fix:** Update the `@Cron` decorators to use `process.env.MORNING_CRON` and `process.env.EVENING_CRON`. 
- **Fix:** Call a new public method on `PlanningOrchestrator` instead of bypassing encapsulation.

### 2. Remove Hardcoded Telegram Chat ID
**File:** `nodejs_space/src/core/application/orchestrators/planning.orchestrator.ts`
- **Current Issue:** The `targetChatId` is hardcoded as `******`.
- **Fix:** Replace the hardcoded `targetChatId` with the `TELEGRAM_CHAT_ID` environment variable via `ConfigService` to make the application portable. Add a new public method `initiateMorningPlanning(chatId: number)` that handles sending the capacity selection to the user cleanly.

## Verification Plan

### Automated Tests
* N/A (We will rely on manual verification and the build process, as this is related to external API integrations and timing mechanisms).
* We will run `yarn build` inside `nodejs_space` to ensure no TypeScript compilation errors occur.

### Manual Verification
1. Start the application locally or via `docker-compose`.
2. Check the logs to ensure the NestJS application connects to Telegram without throwing a `401 Unauthorized` error.
3. Send a `/start` command to the Telegram bot to confirm it responds.
4. Verify the application logs successfully map the cron jobs at the specified environment values instead of the hardcoded defaults.
