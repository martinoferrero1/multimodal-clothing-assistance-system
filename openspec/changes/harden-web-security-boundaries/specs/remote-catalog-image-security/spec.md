## Purpose

Defines SSRF-resistant and resource-bounded retrieval of remote catalog images used for visual similarity without making catalog availability a requirement for search.

## ADDED Requirements

### Requirement: Remote catalog URLs are validated before every connection
The visual-similarity fetcher SHALL accept only configured HTTP schemes, SHALL reject URLs containing credentials or malformed authority data, and SHALL allow connections only to publicly routable destination addresses. DNS results SHALL be checked before connection, and the connected destination SHALL remain constrained to the validated result.

#### Scenario: URL uses an unsupported scheme
- **WHEN** a catalog image URL uses a local-file, data, loopback-oriented, or other unsupported scheme
- **THEN** the image is not requested and visual scoring skips that product

#### Scenario: DNS resolves to a non-public address
- **WHEN** any selected destination resolves to loopback, private, link-local, multicast, reserved, unspecified, or otherwise non-public address space
- **THEN** the connection is rejected before an HTTP request is sent

#### Scenario: DNS answer changes before connection
- **WHEN** the connection target does not satisfy the address set and public-address policy established for the request
- **THEN** the fetch fails closed and does not connect to the changed destination

### Requirement: Redirects are bounded and revalidated
Remote image redirects SHALL be followed only up to a configured hop limit. Every redirect target SHALL pass the complete scheme, authority, DNS, address, and credential validation before the next connection.

#### Scenario: Redirect reaches another public image host
- **WHEN** a response redirects within the hop limit to another valid public destination
- **THEN** the destination is independently validated before it is requested

#### Scenario: Redirect targets an internal service
- **WHEN** any redirect points to a non-public or otherwise forbidden destination
- **THEN** the redirect chain is stopped and no request is sent to that destination

#### Scenario: Redirect limit is exceeded
- **WHEN** a remote image exceeds the configured redirect count
- **THEN** fetching stops and visual scoring skips that image

### Requirement: Remote responses are bounded and verified as images
The fetcher SHALL apply configured connection, read, and total deadlines; SHALL stream no more than the configured response-byte limit; and SHALL require both a supported response media type and compatible supported image bytes. It SHALL not forward ambient application credentials, cookies, or unapproved proxy configuration to catalog hosts.

#### Scenario: Remote server is slow
- **WHEN** connection, response reads, or total retrieval exceed an applicable deadline
- **THEN** fetching is cancelled and the product receives no visual score from that image

#### Scenario: Response exceeds the byte limit
- **WHEN** headers or streamed response bytes exceed the configured maximum
- **THEN** fetching stops without buffering the remaining body

#### Scenario: Response is not really an image
- **WHEN** the server declares an image type but the response bytes are unsupported, corrupt, or incompatible with that declaration
- **THEN** the response is rejected and is not passed to visual feature extraction

#### Scenario: Outbound request is inspected
- **WHEN** a catalog image is fetched
- **THEN** the request contains no Lookeate session cookie, authorization credential, or unrelated inbound header

### Requirement: Unsafe or unavailable images degrade visual search safely
A catalog image fetch failure SHALL affect only that image's visual score and SHALL NOT fail the overall product search. Public errors and logs SHALL not expose internal addresses, credentials, or sensitive URL components.

#### Scenario: Some candidate images fail security validation
- **WHEN** visual similarity can score only a subset of catalog candidates
- **THEN** scored candidates use available visual signals and rejected candidates continue under existing non-visual ranking behavior

#### Scenario: All candidate images fail
- **WHEN** no remote candidate image can be fetched and converted into a safe visual feature
- **THEN** the search returns results through the existing semantic, textual, and structured ranking path

#### Scenario: Failure is recorded
- **WHEN** a remote fetch is rejected or fails
- **THEN** diagnostics record a non-sensitive failure category without logging credentials, private destination details, or full sensitive URLs
