# Design: Resumen diario por email

## Technical Approach

Implement an automated daily sales summary system using a scheduled cron job that aggregates sales data from the previous calendar day and delivers it via HTML emails to company administrators.

The implementation follows a service-oriented approach:
- **`summary-service.js`**: Responsible for executing SQL aggregations to calculate daily KPIs.
- **`email-service.js`**: Responsible for the SMTP transport and rendering the HTML template.
- **`node-cron`**: Orchestrates the execution based on company-specific preferences stored in the database.

## Architecture Decisions

### Decision: Scheduling Mechanism
**Choice**: `node-cron`
**Alternatives considered**: System-level crontab, `agenda` (MongoDB based).
**Rationale**: `node-cron` is lightweight, has no external dependencies (unlike `agenda`), and allows for dynamic scheduling within the Node.js process, which is sufficient for the current deployment scale.

### Decision: Service Separation
**Choice**: Separate `SummaryService` and `EmailService`.
**Alternatives considered**: Combined `NotificationService`.
**Rationale**: Separates the business logic of "what data to aggregate" (Summary) from "how to deliver it" (Email), making it easier to test the aggregation logic without sending real emails.

### Decision: Recipient Selection
**Choice**: Send to all users with `owner` or `admin` roles in the company.
**Alternatives considered**: Send only to the `created_by` user.
**Rationale**: Ensures all decision-makers in the company receive the summary, matching the "company owners and admins" requirement in the spec.

## Data Flow

```
[node-cron] ──→ [Scheduler Loop] ──→ [SummaryService] ──→ [EmailService] ──→ [SMTP/User]
                                           │               │
                                           └─→ [SQLite DB] ←┘
```

1. **Trigger**: `node-cron` runs every minute.
2. **Filter**: The scheduler queries `companies` for those where `email_summary_enabled = 1` and `email_summary_time` matches the current `HH:mm`.
3. **Aggregation**: `SummaryService` calculates yesterday's totals, top products, and user performance.
4. **Delivery**: `EmailService` merges the data into an HTML template and sends it via `nodemailer`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `database.js` | Modify | Add `email_summary_enabled` and `email_summary_time` columns to `companies` table. |
| `routes/companies.js` | Modify | Add `PATCH /api/companies/:id/settings` to manage summary preferences. |
| `server.js` | Modify | Initialize the cron job and import services. |
| `services/summary-service.js` | Create | Logic for aggregating daily sales data from SQLite. |
| `services/email-service.js` | Create | Nodemailer configuration and email sending logic. |
| `templates/email-summary.html` | Create | "One UI" styled HTML template for the summary. |
| `package.json` | Modify | Add `nodemailer` and `node-cron` dependencies. |

## Interfaces / Contracts

### API: Update Company Settings
`PATCH /api/companies/:id/settings`
**Body**:
```json
{
  "email_summary_enabled": boolean,
  "email_summary_time": "HH:mm"
}
```

### Summary Data Structure
The `SummaryService` will return an object:
```javascript
{
  companyName: string,
  date: string, // "YYYY-MM-DD"
  metrics: {
    totalAmount: number,
    totalNotes: number
  },
  topProducts: [
    { name: string, quantity: number }
  ],
  salesByUser: [
    { name: string, amount: number }
  ]
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `SummaryService` aggregation queries | Mock DB and verify calculated totals for a set of test sales. |
| Unit | `EmailService` template rendering | Verify that the returned HTML contains the expected data values. |
| Integration | Cron Job Trigger | Use a test environment to set a company summary time to "now + 1 min" and verify email trigger. |
| API | Settings endpoint | Test authorization (owner/admin) and database persistence. |

## Migration / Rollout

**Database Migration**:
Added via `ALTER TABLE` in `database.js`'s `initSchema()` to ensure backward compatibility and automatic deployment.

**Env Vars**:
The following variables must be added to the environment:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
