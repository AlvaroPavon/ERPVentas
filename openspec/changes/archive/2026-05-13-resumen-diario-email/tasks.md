# Tasks: Resumen diario por email

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Implementation of core services, database, and API | PR 1 | Full feature implementation |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Add `nodemailer` and `node-cron` to `package.json`.
- [x] 1.2 Update `initSchema()` in `database.js` to include `email_summary_enabled` (BOOLEAN) and `email_summary_time` (TEXT) in `companies`.
- [x] 1.3 Create `templates/email-summary.html` with "One UI" styling and placeholder variables.

## Phase 2: Core Implementation (Services)

- [x] 2.1 Create `services/summary-service.js` with `getDailySummary(companyId, date)` method.
- [x] 2.2 Create `services/email-service.js` using `nodemailer` for HTML email delivery.

## Phase 3: API and Wiring

- [x] 3.1 Implement `PATCH /api/companies/:id/settings` in `routes/companies.js`.
- [x] 3.2 Update `server.js` to initialize the cron job and services.

## Phase 4: Testing

- [x] 4.1 Write unit tests for `SummaryService` in `tests/services/summary-service.test.js`.
- [x] 4.2 Write unit tests for `EmailService` in `tests/services/email-service.test.js`.
- [x] 4.3 Write integration tests for settings API and cron trigger in `tests/integration/email-summary.test.js`.
