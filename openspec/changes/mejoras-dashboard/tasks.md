# Tasks: Dashboard Enhancements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (i18n) $\rightarrow$ PR 2 (Multi-company & Metrics) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Implement i18n engine and language persistence | PR 1 | base: main; includes DB migration, locale files, and i18n logic |
| 2 | Implement multi-company filtering and comparative metrics | PR 2 | base: PR 1; includes RBAC, SQL CTEs, and enhanced dashboard UI |

## Phase 1: Foundation & i18n

- [x] 1.1 `database.js`: Add `language` column to `users` table (default 'es')
- [x] 1.2 `public/js/i18n.js`: Create lightweight `I18n` manager class (load, t)
- [x] 1.3 `public/locales/*.json`: Create JSON translation files for es, en, ca, eu, gl
- [x] 1.4 `public/js/api.js`: Add `updateLanguage(lang)` and `getUserLanguage()` methods
- [x] 1.5 `public/js/app.js`: Initialize `I18n` manager during app startup
- [x] 1.6 `public/js/pages/home.js`: Add language selector UI and replace hardcoded strings with `I18n.t()`

## Phase 2: Multi-company & Comparative Metrics — COMPLETE ✅

- [x] 2.1 `routes/dashboard.js`: Add `companyId` query param support and RBAC validation
- [x] 2.2 `routes/dashboard.js`: Implement SQL CTEs for Period-over-Period (PoP) calculation
- [x] 2.3 `public/js/api.js`: Update dashboard data methods to accept and pass `companyId`
- [x] 2.4 `public/js/pages/home.js`: Add company selector UI for Admin/Owner roles
- [x] 2.5 `public/js/pages/home.js`: Implement visual indicators ($\uparrow \downarrow$) for PoP growth

## Phase 3: Testing & Verification — COMPLETE ✅

- [x] 3.1 Integration: Verify language preference persists after page refresh
- [x] 3.2 Integration: Verify 403 Forbidden when accessing unauthorized `companyId`
- [x] 3.3 Unit: Test `I18n.t()` fallback to default language (English)
- [x] 3.4 Unit: Test PoP growth calculation logic (including zero-division/new period cases)

## Phase 4: Cleanup & Documentation — COMPLETE ✅

- [x] 4.1 Update project documentation to include new dashboard features
