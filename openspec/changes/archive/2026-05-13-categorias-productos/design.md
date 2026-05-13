# Design: Categorías y Etiquetas en Productos

## Technical Approach

The goal is to evolve the product catalog from a simple text-based category to a centralized category management system and a flexible tagging system. 

We will introduce a `categories` table to avoid data redundancy and allow easy renaming of categories across all associated products. For tags, we will use a JSON array stored in a `TEXT` column in the `products` table, leveraging SQLite's JSON functions for efficient filtering.

## Architecture Decisions

### Decision: Centralized Categories Table
**Choice**: Create a `categories` table with a 1:N relationship to `products`.
**Alternatives considered**: Keep categories as a text field in `products`.
**Rationale**: Centralized management allows renaming a category once and having it reflect across all products. It also enables a dedicated API for category management.

### Decision: JSON Storage for Tags
**Choice**: Store tags as a JSON array string in the `products` table.
**Alternatives considered**: A separate `tags` table and a `product_tags` join table.
**Rationale**: For the current scope, a JSON array is simpler to implement and maintain. SQLite's `json_each` function provides enough power to perform "contains any" (OR logic) filtering without the complexity of a many-to-many schema.

### Decision: Category Filtering via Name
**Choice**: The `category` query parameter in `GET /products` will be matched against the category name.
**Alternatives considered**: Use `category_id`.
**Rationale**: Matches the specification requirement (`category=comida`) and provides a more user-friendly API.

## Data Flow

### Product Filtering Flow
`Client` $\xrightarrow{\text{GET /products?category=X\&tags=Y,Z}}$ `routes/products.js` $\xrightarrow{\text{SQL JOIN + JSON\_EACH}}$ `database.js` $\xrightarrow{\text{JSON Response}}$ `Client`

### Category Management Flow
`Client` $\xrightarrow{\text{CRUD /categories}}$ `routes/categories.js` $\xrightarrow{\text{SQL}}$ `database.js` $\xrightarrow{\text{JSON Response}}$ `Client`

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `database.js` | Modify | Add `categories` table, add `category_id` and `tags` columns to `products`, implement migration from `category` (text) to `category_id`. |
| `routes/categories.js` | Create | New routes for CRUD operations on categories. |
| `routes/products.js` | Modify | Update `GET /` for filtering, `POST /` for `category_id` and `tags`, and add `PUT /:productId`. |
| `server.js` | Modify | Mount `routes/categories.js`. |
| `tests/products.test.js` | Modify | Add tests for filtering, tagging, and product updates. |
| `tests/categories.test.js` | Create | New test suite for category management. |

## Interfaces / Contracts

### Category Model
```javascript
{
  id: number,
  company_id: number,
  name: string,
  created_at: string
}
```

### Product Model (Updated)
```javascript
{
  id: number,
  company_id: number,
  name: string,
  price: number,
  category_id: number | null, // FK to categories.id
  tags: string[],            // JSON array
  image_url: string | null,
  created_by: number,
  created_at: string,
  prices: Array<{name: string, price: number, quantity: number}> | null
}
```

### API Contracts

#### `GET /api/companies/:companyId/products`
- Query params: `category` (string), `tags` (comma-separated string).
- Logic: `category` filters by name; `tags` filters if product has ANY of the requested tags.

#### `POST /api/companies/:companyId/categories`
- Body: `{ name: string }`

#### `PATCH /api/companies/:companyId/categories/:categoryId`
- Body: `{ name: string }`

#### `DELETE /api/companies/:companyId/categories/:categoryId`
- Action: Delete category and set `products.category_id = NULL` for linked products.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration | Category CRUD | Create, rename, delete categories; verify company isolation. |
| Integration | Product Filtering | Test category filter, tags filter (single/multiple), and combined filters. |
| Integration | Product Update | Verify `PUT` updates `category_id` and `tags` correctly. |
| Migration | Data Integrity | Verify existing `category` text is migrated to `categories` table and `category_id`. |

## Migration / Rollout

1. **Schema Update**: Create `categories` table and add `category_id`/`tags` to `products`.
2. **Data Migration**:
   - `INSERT INTO categories (company_id, name) SELECT DISTINCT company_id, category FROM products WHERE category != '';`
   - `UPDATE products SET category_id = (SELECT id FROM categories WHERE categories.name = products.category AND categories.company_id = products.company_id);`
3. **Cleanup**: The `category` text column will be kept temporarily for safety, then deprecated.

## Open Questions

- [ ] Should we implement a "slug" for categories to make URLs cleaner in the future? (Decided: Not in scope for now).
