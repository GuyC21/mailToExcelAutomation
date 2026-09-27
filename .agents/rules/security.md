# Security & Hardening Rules

These rules are ALWAYS active across this workspace. Security is a non-negotiable priority at every stage, from high-level system design down to the smallest detail (הפרטים הקטנים).

## 1. Zero Secrets & Sensitive Data Leakage
- **No Hardcoded Credentials**: NEVER hardcode API keys, secrets, access tokens, passwords, private keys, or certificates into source code or config files.
- **Environment Variables**: Always load secrets through environment variables or secure vault mechanisms.
- **Example/Template Files Only**: Provide only `.env.example` or `.env.template` with sanitized placeholder values. Never commit actual `.env` files.
- **Logging Sanitization**: Never log passwords, bearer tokens, API keys, session IDs, authorization headers, or PII (Personally Identifiable Information). Redact or mask sensitive fields before logging.
- **Git Hygiene**: Ensure `.gitignore` explicitly prevents accidental leakage of `.env`, `*.pem`, `*.key`, credentials, logs, and build artifacts.

## 2. Input Validation & Defense-in-Depth
- **Never Trust Input**: Validate and sanitize all external inputs at application boundaries (API requests, CLI inputs, query params, headers, file uploads).
- **Injection Prevention**:
  - SQL/NoSQL: Always use parameterized queries or trusted ORM/ODM abstraction layers. Never concatenate user strings into queries.
  - Command Injection: Avoid shell execution (`exec`, `eval`) with user input. If subprocesses are required, pass arguments as discrete arrays, never concatenated strings.
  - Path Traversal: Sanitize file paths, reject `../` traversal, and restrict file operations to designated whitelisted directories.
  - XSS & HTML Injection: Escape/encode outputs when rendering user data.

## 3. Architecture & Authentication / Authorization
- **Principle of Least Privilege**:
  - Grant only the permissions, scopes, and database access levels strictly necessary for the operation.
  - Services, tokens, and database users must operate with minimal required privileges.
- **Secure Communication**: Enforce TLS/HTTPS for all external communication and sensitive internal service-to-service RPCs.
- **Fail Securely**: Default to denying access (`deny-all` default). If authentication or authorization checks fail, terminate immediately with generic, safe error messages (no stack traces or internal schema exposure to clients).

## 4. Dependencies & Supply Chain
- Pin dependency versions and avoid unverified or abandoned third-party packages.
- Review third-party dependencies for known vulnerabilities before adding them.
