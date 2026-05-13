# Product Management Specification

## Purpose

Manage the lifecycle of products, including their association with categories and tags.

## Requirements

### Requirement: Create Product with Category and Tags

The system MUST allow creating a product associated with a category ID and a list of tags.

#### Scenario: Create product with valid category and tags

- GIVEN a valid category ID `123` and tags `["winter", "sale"]`
- WHEN the user creates a product with these values
- THEN the system SHALL link the product to category `123` and assign the tags

#### Scenario: Create product without category or tags

- GIVEN no category and no tags provided
- WHEN the user creates a product
- THEN the system SHALL create the product with `category_id = NULL` and an empty tag list

### Requirement: Update Product Category and Tags

The system MUST allow updating the category and tags of an existing product.

#### Scenario: Change product category

- GIVEN a product linked to category `123`
- WHEN the user updates the product to category `456`
- THEN the system SHALL update the link to category `456`

#### Scenario: Update product tags

- GIVEN a product with tags `["old"]`
- WHEN the user updates the product with tags `["new", "updated"]`
- THEN the system SHALL replace the old tags with the new list
