# Daily Email Summary Specification

## Purpose
Provide company owners and admins with an automated daily summary of their sales via email to monitor business performance without needing to log into the PWA.

## Requirements

### Requirement: Daily Summary Configuration
The system MUST allow company administrators to manage the delivery of the daily sales summary.

#### Scenario: Enable and Schedule Summary
- GIVEN a company admin is authenticated
- WHEN the admin updates the company settings to enable the daily summary and sets the delivery time to "08:00"
- THEN the system MUST store these preferences in the database
- AND the summary MUST be scheduled for delivery at 08:00 daily.

#### Scenario: Disable Summary
- GIVEN a company admin is authenticated and the daily summary is currently enabled
- WHEN the admin updates the company settings to disable the daily summary
- THEN the system MUST stop sending the daily summary emails for that company.

### Requirement: Automated Summary Trigger
The system MUST automatically generate and send the summary email for all eligible companies at their configured time.

#### Scenario: Scheduled Delivery
- GIVEN multiple companies have the daily summary enabled with different scheduled times
- WHEN the system clock reaches a configured delivery time (e.g., 08:00)
- THEN the system MUST trigger the summary generation and delivery process for all companies scheduled for that time.

### Requirement: Sales Data Aggregation
The system MUST aggregate accurate sales data for the period of the previous calendar day.

#### Scenario: Daily Data Calculation
- GIVEN a company with sales recorded on the previous day
- WHEN the summary process runs
- THEN the system MUST calculate the total sales amount and total number of notes for that company from the previous day (00:00:00 to 23:59:59).

### Requirement: Email Delivery
The system MUST send a professionally formatted HTML email containing the summary data.

#### Scenario: Email Content and Delivery
- GIVEN the aggregated data for a company
- WHEN the email service is called
- THEN the system MUST send an email to the company's registered owner/admin email address
- AND the email MUST be in HTML format, following the One UI design guidelines, containing the total sales and total notes for the previous day.

#### Scenario: Email Delivery Failure
- GIVEN the aggregated data for a company
- WHEN the email service fails to send the email (e.g. SMTP error)
- THEN the system MUST log the error for administrative review
- AND the process MUST continue to the next company without crashing.
