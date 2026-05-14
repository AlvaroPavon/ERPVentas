# dashboard-comparative-metrics Specification

## Purpose

Provide performance indicators with comparison data against previous time periods.

## Requirements

### Requirement: Period-over-Period Metric Calculation

The system SHALL calculate the difference between the current time period and the immediately preceding period of the same duration.

#### Scenario: Positive Growth Calculation
- GIVEN current period sales are $1200 and previous period sales were $1000
- WHEN the dashboard metrics are calculated
- THEN the system SHALL compute a growth of +20%
- AND the metric SHALL be stored for frontend rendering

#### Scenario: Negative Growth Calculation
- GIVEN current period sales are $800 and previous period sales were $1000
- WHEN the dashboard metrics are calculated
- THEN the system SHALL compute a growth of -20%

### Requirement: Comparative Visual Indicators

The system SHALL display the calculated percentage change as a visual indicator next to the primary metric.

#### Scenario: Displaying Growth
- GIVEN a positive growth percentage (+20%)
- WHEN the dashboard is rendered
- THEN the system SHALL display the percentage with a positive indicator (e.g., green color or upward arrow)

#### Scenario: Handling Zero Base Period
- GIVEN current period sales are $500 and previous period sales were $0
- WHEN the dashboard metrics are calculated
- THEN the system SHALL avoid division by zero
- AND the visual indicator SHALL display "New" or "N/A" instead of a percentage
