# Skill: Java + Spring Boot + Hexagonal Architecture

Conventions and patterns for EUDIStack Java backend services.

## Tech Stack

- **Java 25**, **Gradle** (Kotlin DSL)
- **Spring Boot 3.5.x** — MVC (verifier) or WebFlux (issuer, wallet)
- **Database:** PostgreSQL via R2DBC (reactive) or JPA (blocking)
- **Migration:** Flyway
- **JWT/Crypto:** nimbus-jose-jwt + BouncyCastle
- **Testing:** JUnit 5, Mockito, WebTestClient (reactive) or MockMvc (MVC)

## Package Structure

```
es.in2.{module}/
├── {boundedcontext}/
│   ├── domain/
│   │   ├── model/          # Records, value objects, enums
│   │   ├── service/        # Business logic interfaces + implementations
│   │   ├── exception/      # Domain exceptions
│   │   └── util/           # Pure utility functions
│   ├── application/
│   │   ├── workflow/       # Use case orchestrators
│   │   └── policy/         # Business rules, validations
│   └── infrastructure/
│       ├── controller/     # REST controllers
│       ├── config/         # Spring configuration
│       ├── adapter/        # External service adapters
│       └── repository/     # Database repositories
└── shared/
    ├── domain/             # Cross-cutting models, crypto utilities
    ├── application/        # Shared workflows
    └── infrastructure/     # Shared config, filters, error handling
```

## Coding Patterns

### Records for Models (Java 17+)

Prefer records for immutable data. Use `@JsonProperty` only when JSON name differs from Java name.

```java
public record CredentialIssuerMetadata(
    @JsonProperty("credential_issuer") String credentialIssuer,
    @JsonProperty("credential_endpoint") String credentialEndpoint,
    @JsonProperty("nonce_endpoint") String nonceEndpoint
) {
    public static CredentialIssuerMetadata build(String baseUrl) {
        return new CredentialIssuerMetadata(
            baseUrl,
            baseUrl + "/credential",
            baseUrl + "/nonce"
        );
    }
}
```

### Service Interfaces in Domain

```java
// domain/service/TokenService.java — interface
public interface TokenService {
    String generateAccessToken(ExtractedClaims claims);
}

// infrastructure/adapter/NimbusTokenService.java — implementation
@Service
public class NimbusTokenService implements TokenService {
    // Framework-dependent implementation
}
```

### Reactive Patterns (WebFlux)

```java
// Use Mono/Flux, never block
public Mono<Credential> issueCredential(CredentialRequest request) {
    return validateRequest(request)
        .flatMap(this::buildCredential)
        .flatMap(this::signCredential);
}

// Error handling with Mono.error
if (request.format() == null) {
    return Mono.error(new InvalidRequestException("format is required"));
}
```

### Blocking Patterns (MVC)

```java
// Standard return types, exceptions for errors
public Credential issueCredential(CredentialRequest request) {
    validateRequest(request);
    var credential = buildCredential(request);
    return signCredential(credential);
}
```

## Build Commands

```bash
./gradlew build          # Full build (compile + test + quality checks)
./gradlew test           # Tests only
./gradlew bootRun        # Run application
./gradlew clean build    # Clean + full build
```

## Test Patterns

### Unit Test

```java
@ExtendWith(MockitoExtension.class)
class TokenServiceImplTest {

    @Mock
    private KeyProvider keyProvider;

    @InjectMocks
    private TokenServiceImpl tokenService;

    @Test
    void generateAccessToken_withValidClaims_returnsSignedJwt() {
        // Given
        var claims = new ExtractedClaims(Map.of("sub", "user123"));
        when(keyProvider.getSigningKey()).thenReturn(testKey());

        // When
        String token = tokenService.generateAccessToken(claims);

        // Then
        assertNotNull(token);
        assertTrue(token.split("\\.").length == 3); // JWT format
    }
}
```

### Integration Test (WebFlux)

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MetadataControllerIT {

    @Autowired
    private WebTestClient webTestClient;

    @Test
    void getIssuerMetadata_returnsCorrectJson() {
        webTestClient.get()
            .uri("/.well-known/openid-credential-issuer")
            .exchange()
            .expectStatus().isOk()
            .expectBody()
            .jsonPath("$.credential_issuer").isNotEmpty()
            .jsonPath("$.credential_endpoint").isNotEmpty();
    }
}
```

### Integration Test (MVC)

```java
@SpringBootTest
@AutoConfigureMockMvc
class MetadataControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getIssuerMetadata_returnsCorrectJson() throws Exception {
        mockMvc.perform(get("/.well-known/openid-credential-issuer"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.credential_issuer").isNotEmpty());
    }
}
```

## Configuration

### Application Properties

```yaml
# application.yml or application-local.yml
spring:
  profiles:
    active: local
  r2dbc:
    url: r2dbc:postgresql://localhost:5432/dbname

# Custom properties under the module namespace
issuer:
  base-url: http://localhost:8080
  signing:
    provider: in-memory     # or csc-sign-hash
```

### Environment Variables

Spring relaxed binding: `ISSUER_BASE_URL` maps to `issuer.base-url`.

## Common Pitfalls

- **Never mix blocking and reactive:** Don't call `.block()` in WebFlux code. Use `.flatMap()` chains.
- **Never import infrastructure in domain:** Domain classes must be framework-free.
- **Always use records for DTOs:** Mutable POJOs are a code smell in this project.
- **Always parameterize SQL:** Never concatenate user input into queries.
- **Never log secrets:** Tokens, keys, passwords, and PII must never appear in logs.
