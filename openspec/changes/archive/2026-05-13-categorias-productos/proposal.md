# Proposal: Categorías/etiquetas en productos

## Intent

The current product management is basic. While a `category` field exists in the database and is partially used in the API (creation and export), it's not fully leveraged. Users cannot easily filter products by category, manage categories centrally (e.g., renaming them), or use tags for more granular grouping. This proposal aims to implement a robust category and tagging system to improve product organization and catalog navigation.

## Scope

### In Scope
- Database schema updates:
    - Create a `categories` table to allow centralized management (renaming) without updating all products.
    - Add `tags` column (TEXT/JSON) to `products` table.
    - Update `products` table to include `category_id` (FK to `categories.id`).
- API updates:
    - `GET /api/companies/:companyId/products`: Add support for `category` and `tags` query parameters for filtering.
    - `POST /api/companies/:companyId/products`: Include `tags` in product creation.
    - `PUT /api/companies/:companyId/products/:productId`: Add endpoint to update product details including `category_id` and `tags`.
    - `GET /api/companies/:companyId/categories`: List all available categories for the company.
    - `POST /api/companies/:companyId/categories`: Create a new category.
    - `PATCH /api/companies/:companyId/categories/:categoryId`: Rename a category.
    - `DELETE /api/companies/:companyId/categories/:categoryId`: Delete a category.
- Frontend updates:
    - Update product creation/editing forms to include category selection (with autocomplete) and tags input.
    - Add category filters to the product catalog view.
    - Add a category management UI section.
- Tests:
    - Add tests for new endpoints and filtering functionality.

### Out of Scope
- Implementation of advanced search (full-text search) beyond simple category/tag filtering.
- Product grouping into "collections" or "bundles" (beyond categories/tags).

## Capabilities

### New Capabilities
- `product-catalog-filtering`: Filter products by category and tags via API.
- `category-management`: CRUD operations for company-specific categories.
- `product-tagging`: Assign multiple tags to products.

### Modified Capabilities
- `product-management`: Updating product creation/editing to support category and tags.

## Approach

1. **Database Layer**: 
   - Implement a `categories` table: `id`, `company_id`, `name`, `created_at`.
   - Update `products` table: add `category_id` (FK) and `tags` (TEXT).
   - Create a migration in `database.js` to:
     - Create `categories` table.
     - Populate `categories` from existing `products.category` values.
     - Update `products.category_id` based on the new table.
     - Add `tags` column.
2. **Backend Layer**:
   - Update `routes/products.js` to handle the new schema and add filtering logic.
   - Implement new category routes (can be in `routes/products.js` or a new file).
3. **Frontend Layer**:
   - Update the UI to use the new API endpoints for category and tag management.
4. **Testing**:
   - Expand `tests/products.test.js` to cover all new functionality.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `database.js` | Modified | Add `categories` table and update `products` schema. |
| `routes/products.js` | Modified | Add filtering, tagging, and category management endpoints. |
| `tests/products.test.js` | Modified | Add tests for new features. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Data migration issues (existing products with categories) | Medium | Migration script will populate `categories` from existing `products.category` data. |
| Performance degradation on large catalogs due to filtering | Low | Ensure appropriate indexes are created on `category_id` and `tags`. |

## Rollback Plan

- To revert:
  - Remove `categories` table and `category_id`/`tags` columns from `products`.
  - Revert code changes in `routes/products.js` and `database.js`.

## Dependencies

- None

## Success Criteria

- [ ] API successfully filters products by category and tags.
- [ ] Users can create, rename, and delete categories via the API.
- [ ] Products can be created and updated with tags and categories.
- [ ] All new endpoints are covered by passing Jest tests.
- [ ] User can successfully filter products in the UI.
