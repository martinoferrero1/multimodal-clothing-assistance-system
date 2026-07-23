## ADDED Requirements

### Requirement: Backend image search mode configuration
The system SHALL provide a backend configuration option for selecting the image search mode, with `characteristics` as the default mode and `visual_similarity` as an alternate mode.

#### Scenario: Default mode preserves existing behavior
- **WHEN** the backend starts without an explicit image search mode
- **THEN** image uploads SHALL be processed using the characteristic-based flow

#### Scenario: Visual mode can be enabled without frontend changes
- **WHEN** the backend is configured with `IMAGE_SEARCH_MODE=visual_similarity`
- **THEN** existing image upload requests SHALL activate visual-similarity processing without requiring a changed frontend payload

### Requirement: Characteristic-based image search mode
The system SHALL support a characteristic-based image search mode that analyzes uploaded images into textual visual characteristics and uses those characteristics in the existing outfit extraction and product search flow.

#### Scenario: Uploaded image contributes textual visual details
- **WHEN** a user sends a message with an image attachment while characteristic mode is active
- **THEN** the backend SHALL include the generated image description in the workflow content used to extract the product request

#### Scenario: Characteristic mode stores analyzed attachment metadata
- **WHEN** image analysis succeeds for an uploaded attachment
- **THEN** the stored message attachment SHALL include the structured analysis payload and summary description

### Requirement: Visual-similarity image search mode
The system SHALL support a visual-similarity image search mode that compares uploaded image content against catalog product images and uses the resulting similarity scores as part of product candidate ranking.

#### Scenario: Visual scores influence candidate ranking
- **WHEN** visual-similarity mode is active and visual features are available for the uploaded image and product candidates
- **THEN** product candidates with higher visual similarity SHALL receive a ranking boost according to backend configuration

#### Scenario: Visual mode keeps structured search constraints
- **WHEN** visual-similarity mode is active and the extracted product request includes priority fields or filters
- **THEN** the backend SHALL apply those constraints before or during candidate selection rather than replacing them with image-only matching

### Requirement: Visual search fallback behavior
The system SHALL preserve existing product search behavior when visual-similarity processing cannot produce usable scores.

#### Scenario: No visual features are available
- **WHEN** visual-similarity mode is active but the uploaded image cannot be converted into visual features
- **THEN** the backend SHALL return candidates using the existing semantic and text ranking flow

#### Scenario: Catalog images are unavailable
- **WHEN** product images are missing or cannot be fetched for visual comparison
- **THEN** the backend SHALL skip visual scoring for those products and SHALL NOT fail the overall product search

### Requirement: Product visual feature reuse
The system SHALL reuse product-side visual features across searches when the source product image has not changed.

#### Scenario: Product visual feature cache hit
- **WHEN** a product image has already been processed for the active visual feature strategy
- **THEN** later visual searches SHALL reuse the stored or cached product visual feature instead of recomputing it

#### Scenario: Product image source changes
- **WHEN** the product image source used for visual comparison changes
- **THEN** the backend SHALL treat the previously stored product visual feature as stale and recompute it when needed
