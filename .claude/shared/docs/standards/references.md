# Normative References

Canonical URLs for all standards and specifications used across EUDIStack.

## OpenID Foundation

| Spec | URL | Version |
|------|-----|---------|
| OID4VCI (Credential Issuance) | https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html | 1.0 Final |
| OID4VP (Verifiable Presentations) | https://openid.net/specs/openid-4-verifiable-presentations-1_0.html | 1.0 Draft |
| DCQL (Digital Credentials Query Language) | https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-digital-credentials-query-l | Part of OID4VP |
| SIOPv2 (Self-Issued OP v2) | https://openid.net/specs/openid-connect-self-issued-v2-1_0.html | 1.0 |
| HAIP (High Assurance Interoperability Profile) | https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0.html | 1.0 |

## IETF RFCs

| Spec | URL | Topic |
|------|-----|-------|
| RFC 9449 | https://datatracker.ietf.org/doc/html/rfc9449 | DPoP (Demonstrating Proof of Possession) |
| RFC 7636 | https://datatracker.ietf.org/doc/html/rfc7636 | PKCE (Proof Key for Code Exchange) |
| RFC 9126 | https://datatracker.ietf.org/doc/html/rfc9126 | PAR (Pushed Authorization Requests) |
| RFC 6749 | https://datatracker.ietf.org/doc/html/rfc6749 | OAuth 2.0 Authorization Framework |
| RFC 6750 | https://datatracker.ietf.org/doc/html/rfc6750 | Bearer Token Usage |
| RFC 7519 | https://datatracker.ietf.org/doc/html/rfc7519 | JWT (JSON Web Token) |
| RFC 7515 | https://datatracker.ietf.org/doc/html/rfc7515 | JWS (JSON Web Signature) |
| RFC 7517 | https://datatracker.ietf.org/doc/html/rfc7517 | JWK (JSON Web Key) |
| RFC 8414 | https://datatracker.ietf.org/doc/html/rfc8414 | OAuth 2.0 Authorization Server Metadata |

## SD-JWT

| Spec | URL | Topic |
|------|-----|-------|
| SD-JWT (Selective Disclosure JWT) | https://datatracker.ietf.org/doc/html/draft-ietf-oauth-selective-disclosure-jwt | Core SD-JWT |
| SD-JWT VC (Verifiable Credentials) | https://datatracker.ietf.org/doc/html/draft-ietf-oauth-sd-jwt-vc | SD-JWT for VCs |

## W3C

| Spec | URL | Topic |
|------|-----|-------|
| VCDM v2.0 | https://www.w3.org/TR/vc-data-model-2.0/ | Verifiable Credentials Data Model |
| DID Core | https://www.w3.org/TR/did-core/ | Decentralized Identifiers |
| Bitstring Status List | https://www.w3.org/TR/vc-bitstring-status-list/ | Credential Revocation |

## EUDI Wallet

| Spec | URL | Topic |
|------|-----|-------|
| ARF (Architecture Reference Framework) | https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework | EU Digital Identity Wallet |
| EUDI Wallet Conformance Tests | https://github.com/eu-digital-identity-wallet/eudi-wallet-conformance-tests | OIDF Conformance |

## JSON Schema

| Spec | URL | Topic |
|------|-----|-------|
| JSON Schema 2020-12 | https://json-schema.org/draft/2020-12/json-schema-core | Core Vocabulary |
| JSON Schema Validation 2020-12 | https://json-schema.org/draft/2020-12/json-schema-validation | Validation Vocabulary |

## How to Use

When implementing a protocol feature:
1. Find the relevant spec in this table
2. Open the URL to read the normative text
3. Pay attention to REQUIRED vs OPTIONAL vs MUST vs SHOULD language
4. Cross-reference with the protocol docs in `docs/protocols/` for project-specific gap analysis
