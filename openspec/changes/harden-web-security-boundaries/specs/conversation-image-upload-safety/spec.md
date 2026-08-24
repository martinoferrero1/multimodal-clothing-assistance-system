## Purpose

Defines safe, bounded acceptance of multipart images submitted to Lookeate Assistant conversations before any image reaches storage or downstream analysis.

## ADDED Requirements

### Requirement: Multipart image requests have bounded quantity and encoded size
The conversation image endpoint SHALL enforce configured limits for attachment count, per-file encoded bytes, and aggregate encoded bytes. It SHALL read each part through a bounded path and SHALL NOT rely only on multipart metadata or `Content-Length` to enforce those limits.

#### Scenario: Attachment count is excessive
- **WHEN** a multipart message contains more than the configured number of images
- **THEN** the system returns `413` and does not create a message or invoke downstream processing

#### Scenario: One image exceeds its byte limit
- **WHEN** an image part exceeds the configured per-file byte limit while being read
- **THEN** the system stops accepting that request, returns `413`, and does not process a truncated image

#### Scenario: Aggregate bytes exceed the request limit
- **WHEN** individually permitted image parts collectively exceed the configured aggregate byte limit
- **THEN** the system returns `413` and rejects the complete message atomically

### Requirement: Accepted image type is derived from content
The system SHALL identify each image from its bytes, SHALL accept only explicitly supported image formats, and SHALL require the declared multipart media type to be compatible with the detected format. Filename extensions and client-declared types SHALL NOT establish trust.

#### Scenario: Declared and actual types agree
- **WHEN** a complete image has a supported byte signature and a compatible declared media type
- **THEN** format validation may proceed to structural and resource checks

#### Scenario: File masquerades as an image
- **WHEN** a part declares an allowed image media type but its bytes are not a supported image
- **THEN** the system returns `415` and does not forward or persist the bytes

#### Scenario: Declared type conflicts with bytes
- **WHEN** the declared image media type is incompatible with the detected image format
- **THEN** the system returns `415` and rejects the complete message

### Requirement: Decoding is bounded by dimensions, pixels, and animation policy
Before accepting an attachment, the system SHALL inspect its dimensions and frame structure under configured maximum width, height, total decoded pixels, and frame-count limits. Animated images SHALL be rejected unless their frame count is within the explicit configured policy, and every accepted frame SHALL fit the pixel budget.

#### Scenario: Dimensions exceed the limit
- **WHEN** an otherwise valid image exceeds the configured width or height
- **THEN** the system returns `413` before analysis or message creation

#### Scenario: Pixel count exceeds the limit
- **WHEN** encoded bytes are small but decoded dimensions or cumulative frame pixels exceed the configured pixel budget
- **THEN** the system returns `413` and does not fully decode the image into downstream memory

#### Scenario: Animation exceeds the frame policy
- **WHEN** an image contains more frames than the configured animation policy permits
- **THEN** the system returns `415` and does not silently accept only one frame

### Requirement: Corrupt and decompression-bomb images fail safely
The system SHALL fully verify enough image structure to reject truncated, corrupt, inconsistent, or decompression-bomb images before constructing downstream attachment data. Decoder warnings indicating decompression-bomb risk SHALL be treated as validation failures rather than ignored.

#### Scenario: Image is truncated or corrupt
- **WHEN** an image has a recognized header but fails structural verification
- **THEN** the system returns a stable non-sensitive validation error and performs no conversation write or provider call

#### Scenario: Decoder reports decompression-bomb risk
- **WHEN** image inspection raises a decompression-bomb warning or error
- **THEN** the system rejects the request and does not retry with relaxed decoder limits

#### Scenario: Multiple attachments include one invalid image
- **WHEN** any attachment in a multipart message fails image validation
- **THEN** the complete message is rejected atomically and no valid sibling attachment is processed downstream
