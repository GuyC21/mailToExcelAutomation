---
name: security-audit
description: >-
  Use this skill to perform security audits, threat modeling, vulnerability reviews, secret leakage checks, and hardening across the system down to small details (.gitignore, env files, credentials).
---

# Security Audit & Hardening Skill

This skill provides a systematic runbook for auditing and hardening the codebase, protecting against vulnerabilities from high-level architecture down to the minutiae ("הפרטים הקטנים").

## Security Audit Workflow

Whenever reviewing a feature, preparing a commit, or designing architecture, execute this checklist:

### Phase 1: Small Details & Leakage Protection (הפרטים הקטנים)
1. **.gitignore Verification**:
   - Verify that all environment files (`.env`, `.env.*`, except `.env.example`), secret keys (`*.pem`, `*.key`, `*.cert`, `*.pfx`), database files (`*.sqlite`, `*.db`), and credential stores (`credentials.json`, `token.json`) are strictly excluded in `.gitignore`.
2. **Staged Changes & Git Inspection**:
   - Inspect diffs specifically for raw tokens, passwords, bearer headers, test API keys, or private internal URLs.
3. **Environment Configuration Safety**:
   - Confirm that configuration relies on runtime environment variables with clear schema validation (e.g., Zod, Joi, or Pydantic).
4. **Log Inspection**:
   - Verify that logging statements never print raw request bodies, authentication headers, database connection strings with passwords, or user PII.

### Phase 2: Application & Code Security (OWASP Focus)
1. **Injection Vectors**:
   - Verify all database queries are parameterized.
   - Verify zero shell concatenations or dynamic code evaluations (`eval`, `Function`, `exec`).
2. **Authentication & Authorization**:
   - Verify every endpoint/handler enforces authentication before executing logic.
   - Verify Object-Level Authorization (IDOR protection): ensure users cannot view or mutate entities belonging to other tenants/users.
3. **Input Validation**:
   - Verify strict type, length, and format validation on all incoming payload fields.
4. **Error Handling & Information Disclosure**:
   - Ensure exceptions return sanitized error responses to the client while logging detailed errors internally. No stack traces or system environment variables should ever leak to the client.

### Phase 3: Architecture & System Security
1. **Zero-Trust Network/Service Boundaries**:
   - Do not trust internal microservices or client-side claims implicitly; validate tokens and signatures at service boundaries.
2. **Rate Limiting & DoS Protection**:
   - Ensure critical endpoints (login, password reset, expensive compute, external LLM calls) have throttling/rate limiting in place.
3. **Data Protection at Rest and in Transit**:
   - Enforce TLS for network transit and modern hashing/encryption (e.g., Argon2id/bcrypt for passwords, AES-256-GCM for sensitive stored data).

## Deliverable Format
When performing a security review, document findings as:
- **Severity**: Critical / High / Medium / Low / Best Practice
- **Location**: File path and line reference
- **Vulnerability / Risk**: What could go wrong or be exploited
- **Remediation**: Exact code or configuration fix to resolve the issue
