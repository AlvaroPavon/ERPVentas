# Proposal: Resumen diario por email

## Intent

Provide company owners and admins with an automated daily summary of their sales via email. This fosters better engagement and awareness of business performance without requiring daily PWA logins.

## Scope

### In Scope
- Automatic daily email generation and sending.
- Configurable daily time for sending and enablement/disablement per company.
- Summary content: total sales amount, total items sold, total sales sessions, top products by quantity, and a breakdown of sales by user.
- HTML email template following the "One UI" design style.
- Scheduling mechanism using `node-cron`.
- Email transport using `nodemailer`.
- Unit and integration tests.

### Out of Scope
- Real-time sales notifications.
- Multiple email formats (only HTML).
- Advanced historical trend reports.

## Capabilities

### New Capabilities
- `daily-sales-summary`: Handles scheduling, data aggregation, templating, and sending of the daily summary.
- `company-settings`: Allows owners/admins to configure summary settings.

### Modified Capabilities
- `companies`: Updated to support new summary configuration settings.

## Approach

1.  **Database Migration**: Add `email_summary_enabled` (boolean) and `email_summary_time` (text) columns to `companies` table.
2.  **Backend Implementation**:
    - New `services/email-service.js` for `nodemailer` management.
    - New `services/summary-service.js` for SQL-based data aggregation.
    - `node-cron` job in `server.js` to trigger summaries based on configured times.
    - New `PATCH /api/companies/:id/settings` endpoint in `routes/companies.js`.
3.  **Email Templating**: Create HTML template matching the app's "One UI" design.
4.  **Testing**: Unit tests for aggregation logic and integration tests for the scheduling trigger.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `database.js` | Modified | Schema migration for company settings. |
| `routes/companies.js` | Modified | New endpoint for configuration. |
| `server.js` | Modified | Cron job initialization. |
| `package.json` | Modified | Addition of `node-cron` and `nodemailer`. |
| `services/` | New | `email-service.js` and `summary-service.js`. |
| `templates/` | New | Email HTML templates. |
| `tests/` | New | New test suites. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| High volume of email failures | Low | Implement retry logic and error logging. |
| Performance impact during aggregation | Medium | Optimize SQL queries and use appropriate indices. |
| Email being flagged as spam | Medium | Use professional SMTP and provide whitelist instructions. |

## Rollback Plan

1.  Revert database migration (remove new columns).
2.  Remove new routes, services, and cron job.
3.  Revert `package.json`.

## Dependencies

- `node-cron`
- `nodemailer`

## Success Criteria

- [ ] Owners can enable/disable and schedule emails.
- [ ] Emails are sent automatically at the scheduled time.
- [ ] Email content contains accurate, aggregated daily data.
- [ ] All new features pass unit and integration tests.
