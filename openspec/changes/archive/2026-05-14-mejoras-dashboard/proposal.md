# Proposal: Dashboard Enhancements

## Intent

Improve the dashboard's usability and administrative utility by introducing multi-language support, multi-company views for administrators, and performance comparison metrics.

## Scope

### In Scope
- Implementation of a lightweight i18n engine for the dashboard.
- Multi-company data filtering for Admin/Owner roles.
- Dashboard indicators showing percentage changes vs. the previous period.
- Database schema updates to support user language preferences.

### Out of Scope
- Full application-wide localization (focus is on the dashboard).
- Migration of historical data for all possible comparison periods.

## Capabilities

### New Capabilities
- `dashboard-i18n`: Manage localization for dashboard elements and user language preferences.
- `admin-multi-company-view`: Enable administrators to view and filter dashboard data across different companies.
- `dashboard-comparative-metrics`: Provide performance indicators with comparison data against previous time periods.

### Modified Capabilities
- None

## Approach

- **Multi-language**: Use JSON translation files with a lightweight frontend engine. Add a `language` column to the `users` table.
- **Multi-company**: Implement a `companyId` query parameter in dashboard endpoints. Admin/Owner roles will be granted permission to bypass the standard `company_users` restriction.
- **Comparisons**: Utilize SQL Common Table Expressions (CTEs) to fetch current and previous period metrics in a single efficient query.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `database.js` | Modified | Add `language` column to `users` table |
| `routes/dashboard.js` | Modified | Add `companyId` filter and period comparison logic |
| `public/js/pages/home.js` | Modified | Add language toggle, company selector, and comparison UI |
| `public/js/api.js` | Modified | Add methods for language and company list |
| `public/js/app.js` | Modified | Initialize i18n engine |
| `public/js/router.js` | Modified | Support i18n initialization in routing |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SQL Performance issues | Medium | Index `session_date` and optimize CTEs |
| i18n rendering lag | Low | Ensure efficient engine and minimal re-renders |
| Unauthorized company access | Low | Strict role-based access control (RBAC) checks |

## Rollback Plan

- Revert database changes (remove `language` column).
- Rollback code changes in backend and frontend.

## Dependencies

- None

## Success Criteria

- [ ] Users can toggle language and preference persists.
- [ ] Admins can switch between company views.
- [ ] Dashboard displays period-over-period percentage indicators.
