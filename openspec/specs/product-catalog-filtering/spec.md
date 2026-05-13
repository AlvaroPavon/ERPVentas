# Product Catalog Filtering Specification

## Purpose

Allow users to filter the product catalog by category and tags to improve navigation and product discovery.

## Requirements

### Requirement: Filter by Category

The system MUST allow filtering products by a specific category.

#### Scenario: Filter by existing category

- GIVEN a product catalog with products in "comida" and "bebida" categories
- WHEN the user requests products with `category=comida`
- THEN the system SHALL return only products belonging to the "comida" category

#### Scenario: Filter by non-existent category

- GIVEN a product catalog
- WHEN the user requests products with `category=nonexistent`
- THEN the system SHALL return an empty list

### Requirement: Filter by Tags

The system MUST allow filtering products by one or more tags.

#### Scenario: Filter by single tag

- GIVEN products with tags ["organic", "local"] and ["industrial"]
- WHEN the user requests products with `tags=organic`
- THEN the system SHALL return products that have the "organic" tag

#### Scenario: Filter by multiple tags (OR logic)

- GIVEN products with tags ["organic"], ["local"], and ["industrial"]
- WHEN the user requests products with `tags=organic,local`
- THEN the system SHALL return products that have either the "organic" OR the "local" tag

### Requirement: Combined Filtering

The system SHOULD allow combining category and tag filters.

#### Scenario: Filter by category and tag

- GIVEN products in "comida" category with tags ["organic", "local"]
- WHEN the user requests products with `category=comida` and `tags=organic`
- THEN the system SHALL return only "comida" products that also have the "organic" tag
