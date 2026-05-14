# admin-multi-company-view Specification

## Purpose

Enable administrators and owners to view and filter dashboard data across different companies.

## Requirements

### Requirement: Multi-Company Data Filtering

The system SHALL allow users with `Admin` or `Owner` roles to filter dashboard data by a specific company ID.

#### Scenario: Admin switches company view
- GIVEN an Admin user is on the dashboard
- WHEN the Admin selects a specific company from the company selector
- THEN the system SHALL update the dashboard data using the `companyId` query parameter
- AND the dashboard SHALL display metrics exclusively for the selected company

#### Scenario: Owner views aggregate data
- GIVEN an Owner user is on the dashboard
- WHEN no specific company is selected (default view)
- THEN the system MAY show aggregate data across all companies they manage

### Requirement: Access Restriction for Non-Privileged Users

The system MUST prevent users without `Admin` or `Owner` roles from accessing data of companies they are not explicitly assigned to.

#### Scenario: Unauthorized Company Access Attempt
- GIVEN a standard user is logged in
- WHEN the user attempts to manually change the `companyId` in the URL to a company they don't belong to
- THEN the system MUST reject the request
- AND the system SHALL return a 403 Forbidden error or redirect to the user's default company view
