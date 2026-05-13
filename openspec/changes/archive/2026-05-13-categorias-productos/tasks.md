# Tasks: Categorías y Etiquetas en Productos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 240-280 |
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
| 1 | Foundation & Category Management | PR 1 | Includes database, categories API, and category tests |

## Phase 1: Foundation & Category Management

- [x] 1.1 Update `database.js`: add `categories` table, add `category_id` (FK) and `tags` (TEXT) to `products` table.
- [x] 1.2 Implement data migration in `database.js`: migrate `products.category` (text) to `categories` table and `products.category_id`.
- [x] 1.3 Create `routes/categories.js`: implement `POST`, `GET`, `PATCH`, and `DELETE` endpoints with company isolation.
- [x] 1.4 Update `server.js`: mount `routes/categories.js` at `/api/companies/:companyId/categories`.
- [x] 1.5 Create `tests/categories.test.js`: test category CRUD, renaming, and deletion (including `NULL` on linked products).

## Phase 2: Product Management & Filtering

- [x] 2.1 Update `routes/products.js`: update `POST /` to accept `category_id` and `tags`.
- [x] 2.2 Update `routes/products.js`: update `PUT /:productId` to allow updating `category_id` and `tags`.
- [x] 2.3 Update `routes/products.js`: implement filtering in `GET /` using `category` (name) and `tags` (JSON_EACH) query parameters.
- [x] 2.4 Update `tests/products.test.js`: add integration tests for filtering (category, tags, combined) and product management (category/tags).
