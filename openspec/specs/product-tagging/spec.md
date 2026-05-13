# Product Tagging Specification

## Purpose

Enable granular grouping of products using tags.

## Requirements

### Requirement: Assign Tags to Products

The system MUST allow assigning multiple tags to a product.

#### Scenario: Create product with tags

- GIVEN a user creating a product
- WHEN the user provides tags `["organic", "premium"]`
- THEN the system SHALL save these tags associated with the product

#### Scenario: Update product tags

- GIVEN a product with tag `["organic"]`
- WHEN the user updates the product with tags `["organic", "local"]`
- THEN the system SHALL update the tag list to exactly `["organic", "local"]`

#### Scenario: Remove all tags

- GIVEN a product with tag `["organic"]`
- WHEN the user updates the product with an empty tag list `[]`
- THEN the system SHALL remove all tags from the product
