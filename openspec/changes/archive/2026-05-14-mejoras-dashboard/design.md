# Design: Dashboard Enhancements

## Technical Approach

The goal is to enhance the dashboard with localization (i18n), administrative multi-company visibility, and performance comparison metrics.

1.  **Localization**: Implement a client-side `I18n` manager that loads JSON translation files based on a `language` preference stored in the `users` table.
2.  **Multi-Company View**: Update dashboard API endpoints to accept an optional `companyId` query parameter. Role-based access control (RBAC) will be enforced to ensure only privileged users (Admin/Owner) can switch views, while standard users are restricted to their assigned companies.
3.  **Comparative Metrics**: Refactor SQL queries in `/api/dashboard` to use Common Table Expressions (CTEs) to calculate metrics for the current and previous periods in a single request, returning growth percentages to the frontend.

## Architecture Decisions

### Decision: i18n Implementation Strategy

**Choice**: Lightweight client-side manager with JSON files.
**Alternatives considered**: Server-side rendering of translations, full i18next library.
**Rationale**: The app is a Vanilla JS SPA. A custom lightweight manager (under 100 lines) avoids heavy dependencies and fits the current architecture while providing the needed functionality.

### Decision: Multi-Company Access Control

**Choice**: Validate `companyId` against `company_users` table in each dashboard route.
**Alternatives considered**: Global Admin role in `users` table.
**Rationale**: The system uses a per-company RBAC model. Checking the user's role within the requested company maintains consistency with the existing permission model.

### Decision: Comparative Metrics Calculation

**Choice**: SQL CTEs for period-over-period (PoP) calculation.
**Alternatives considered**: Two separate API calls, frontend calculation.
**Rationale**: CTEs are more efficient, reducing network round-trips and leveraging the DB engine for aggregations.

## Data Flow

### i18n Flow
`App.init` $\rightarrow$ `API.me()` (get language) $\rightarrow$ `I18n.load(lang)` $\rightarrow$ `renderHome()` (use `I18n.t()`)

### Multi-Company Flow
Frontend Selector $\rightarrow$ `API.getMonthly(year, month, companyId)` $\rightarrow$ `routes/dashboard.js` $\rightarrow$ RBAC Check $\rightarrow$ SQL Filter `WHERE company_id = ?` $\rightarrow$ Response

### Metrics Flow
Request $\rightarrow$ SQL CTE (Current Period $\cup$ Previous Period) $\rightarrow$ Growth % Calculation $\rightarrow$ Frontend Visual Indicator ($\uparrow \downarrow$)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `database.js` | Modify | Add `language` column to `users` table (default 'es') |
| `routes/dashboard.js` | Modify | Update endpoints to handle `companyId` and implement comparative CTEs |
| `public/js/api.js` | Modify | Add `updateLanguage(lang)` and update dashboard methods to pass `companyId` |
| `public/js/app.js` | Modify | Initialize `I18n` manager after auth |
| `public/js/i18n.js` | Create | New lightweight translation engine |
| `public/locales/*.json`| Create | Translation files for es, en, ca, eu, gl |
| `public/js/pages/home.js`| Modify | Add company selector, language toggle, and PoP visual indicators |

## Interfaces / Contracts

### i18n Engine API
```javascript
class I18n {
  async load(lang) { /* loads /locales/{lang}.json */ }
  t(key) { /* returns translation or key if missing */ }
}
```

### Updated Dashboard API
`GET /api/dashboard/monthly?year=2026&month=5&companyId=123`
Response:
```json
{
  "stats": {
    "total_amount": 1500.00,
    "growth": 12.5, // Percentage vs previous period
    "trend": "up"   // "up" | "down" | "neutral"
  },
  "dailySales": [...]
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration | i18n persistence | Change language $\rightarrow$ Refresh $\rightarrow$ Verify language remains |
| Integration | Multi-company access | Attempt to access `companyId` not assigned $\rightarrow$ Verify 403 |
| Unit | Comparative logic | Mock DB data $\rightarrow$ Verify growth % calculation (including zero-division) |

## Migration / Rollout

- **Database**: Execute `ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'es'` during `initSchema`.
- **Frontend**: Gradually introduce `I18n.t()` in `home.js` widgets.

## Open Questions

- [ ] Should Owners be able to view *any* company regardless of membership, or only companies they created/joined? (Decision: Only joined/managed companies to maintain security).
