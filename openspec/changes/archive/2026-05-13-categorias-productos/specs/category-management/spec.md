# Category Management Specification

## Purpose

Provide centralized management of product categories for each company.

## Requirements

### Requirement: Create Category

The system MUST allow the creation of company-specific categories.

#### Scenario: Create a new category

- GIVEN an authenticated user with `manage_products` permission
- WHEN the user creates a category "Bebidas" for their company
- THEN the system SHALL save the category and return its ID

#### Scenario: Create category with empty name

- GIVEN an authenticated user
- WHEN the user attempts to create a category with an empty name
- THEN the system MUST return a 400 Bad Request error

### Requirement: List Categories

The system MUST allow listing all categories associated with a company.

#### Scenario: List company categories

- GIVEN a company with categories "Comida" and "Bebida"
- WHEN the user requests the list of categories for that company
- THEN the system SHALL return both categories sorted by name

### Requirement: Rename Category

The system MUST allow renaming an existing category.

#### Scenario: Rename category

- GIVEN a category "Bebidas"
- WHEN the user renames it to "Bebidas Alcohólicas"
- THEN the system SHALL update the category name and all linked products SHALL now effectively belong to "Bebidas Alcohólicas"

### Requirement: Delete Category

The system MUST allow deleting a category.

#### Scenario: Delete category without linked products

- GIVEN a category "Test" with no products linked
- WHEN the user deletes the category
- THEN the system SHALL remove the category from the database

#### Scenario: Delete category with linked products

- GIVEN a category "Comida" with linked products
- WHEN the user deletes the category
- THEN the system SHALL remove the category and set the `category_id` of linked products to NULL
