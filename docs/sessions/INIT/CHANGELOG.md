# AI Secretary Initial Changelog

This document contains the legacy version history extracted from the original `.ai-instructions.md` file before the security refactoring.

## 🔄 Update History

### v3.0 (March 2026 - Hexagonal Refactor)
- **Refactoring:** Fully migrated to Hexagonal Architecture (Ports & Adapters).
- **Decoupling:** Transport layer, Core logic, and Infrastructure adapters strictly separated.
- **Asynchronous Flow:** Replaced blocking API calls with BullMQ processing queues + EventEmitter.
- **Reliability:** Background retry support, structured domain events.

### v2.1 - March 2026
- Added mandatory two-way sync for postponements
- Inline button removal after click
- Combined evening checkup messages
- 24/7 new task notifications

### v2.0 - February 2026
- Added LLM integration
- Morning/evening planning automation
- Smart postponement tracking

### v1.0 - January 2026
- Initial database-first architecture
- Jira ↔ TickTick sync
- Telegram bot integration
