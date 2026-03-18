## ADDED Requirements

### Requirement: Sidebar Layout Shell
Re-architect the NotebookLM homepage to include a navigation sidebar.

#### Scenario: Desktop Grid Layout
- **WHEN** page loads on a screen wider than 1024px
- **THEN** `.welcome-page-container` MUST use a two-column grid layout with the sidebar occupying the first column (280-320px).

#### Scenario: Sidebar Stickiness
- **WHEN** user scrolls vertically
- **THEN** the folder sidebar MUST remain within the viewport using sticky positioning.

#### Scenario: Mobile Responsive Adaptation
- **WHEN** screen width is less than 1024px
- **THEN** the layout MUST revert to a single column, placing the folders back at the top.
