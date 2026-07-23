## MODIFIED Requirements

### Requirement: Visual-similarity image search mode
The system SHALL support a visual-similarity image search mode that directly compares uploaded image content against eligible catalog product images and combines the resulting similarity scores with text, semantic, and structured product ranking.

#### Scenario: Image-led searches can retrieve visually similar products directly
- **WHEN** visual-similarity mode is active and visual features are available for the uploaded image and catalog products
- **THEN** product candidates with high visual similarity SHALL be eligible for selection even when they are not in the top text-ranked candidate slice

#### Scenario: Visual scores combine with concrete text constraints
- **WHEN** visual-similarity mode is active and the user includes text constraints along with an uploaded image
- **THEN** the backend SHALL rank candidates using both visual similarity and the extracted text or structured constraints

#### Scenario: Visual mode keeps structured search constraints
- **WHEN** visual-similarity mode is active and the extracted product request includes priority fields or filters
- **THEN** the backend SHALL apply those constraints before or during candidate selection rather than replacing them with image-only matching
