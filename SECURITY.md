# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Soko Tabiri, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [TODO: Add security contact email]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to understand and address the issue.

## Security Measures

### 1. Privacy-First Architecture

Soko Tabiri is built with privacy as the default:

- **Shielded-only transactions**: All transactions use Zcash shielded addresses (z-to-z) by default
- **No PII storage**: Users are identified by viewing key hashes, not personal data
- **Transparent address flows**: Only available with explicit `ALLOW_DESHIELD=true` AND `DESHIELD_KYC=true` flags

### 2. Key Management

**Critical**: Private keys are NEVER stored in environment variables or code.

- All signing operations use KMS/HSM (AWS KMS, GCP KMS, Azure Key Vault, or HashiCorp Vault)
- `KMS_KEY_ID` references external key storage, not the key itself
- Mock KMS is available for development only (`KMS_PROVIDER=mock`)

### 3. Service-to-Service Authentication

Internal services communicate via HMAC-authenticated requests:

- `X-Soko-Signature`: HMAC-SHA256 signature of request
- `X-Soko-Timestamp`: Unix timestamp (5-minute tolerance)
- Constant-time comparison to prevent timing attacks

### 4. Database Security

- Connection strings use environment variables
- Prepared statements prevent SQL injection
- Row-level security recommended for production
- Sensitive data (viewing keys) stored as hashes only

### 5. API Security

- CORS restricted to allowed origins
- Rate limiting recommended for production
- Input validation on all endpoints
- Error messages don't leak internal details in production

## Security Checklist for Deployment

Before deploying to production:

- [ ] Replace all default secrets (`INTERNAL_HMAC_SECRET`, database passwords)
- [ ] Configure KMS provider (not `mock`)
- [ ] Enable TLS for all services
- [ ] Set `NODE_ENV=production`
- [ ] Configure rate limiting
- [ ] Enable database connection encryption
- [ ] Set up log aggregation and monitoring
- [ ] Review and restrict CORS origins
- [ ] Enable security headers (Helmet.js recommended)
- [ ] Configure network policies (if using Kubernetes)
- [ ] Set up secrets management (Vault, AWS Secrets Manager, etc.)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Updates

Security updates are released as patch versions. Subscribe to releases to be notified.

## Compliance

Soko Tabiri is designed with privacy regulations in mind:

- **GDPR**: Minimal data collection, no PII storage
- **Financial regulations**: KYC required for transparent transactions
- **Zcash compliance**: Follows Zcash best practices for shielded transactions

## Third-Party Dependencies

We regularly audit dependencies for vulnerabilities:

```bash
npm audit
```

Critical vulnerabilities are addressed within 24 hours.

