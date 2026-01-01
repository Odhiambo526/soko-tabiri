# Threat Model

## Overview

This document outlines the top security threats to Soko Tabiri and their mitigations.

## System Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Gateway    │────▶│   Engine    │
│   (React)   │     │    API      │     │ (AMM/Order) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Oracle    │     │ Settlement  │
                    │  (Dispute)  │     │(Lightwalletd)│
                    └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │    KMS/HSM  │
                                       │  (Signing)  │
                                       └─────────────┘
```

## Top 6 Threats and Mitigations

### 1. Private Key Compromise

**Threat**: Attacker gains access to Zcash private keys, enabling theft of all funds.

**Attack Vectors**:
- Keys stored in environment variables
- Keys in source code or logs
- Memory dump attacks
- Insider threat

**Mitigations**:
- ✅ Keys stored in KMS/HSM only (never in env vars)
- ✅ Settlement service is the only component with key access
- ✅ KMS_KEY_ID is a reference, not the key itself
- ⚠️ TODO: Implement multi-signature for large transactions
- ⚠️ TODO: Hardware security module (HSM) for production

**Residual Risk**: Medium (depends on KMS provider security)

---

### 2. Oracle Manipulation / False Attestations

**Threat**: Malicious reporters submit false market outcomes to profit from positions.

**Attack Vectors**:
- Colluding reporters
- Bribed reporters
- Compromised reporter accounts

**Mitigations**:
- ✅ Bonded stake required for reporters (slashable)
- ✅ Dispute window allows challenges (default 24h)
- ✅ Stake slashing for false attestations
- ✅ Multiple reporter consensus (when implemented)
- ⚠️ TODO: Reputation system for reporters
- ⚠️ TODO: Escalation to governance for disputed outcomes

**Residual Risk**: Medium (economic incentives align with honest behavior)

---

### 3. Deanonymization / Privacy Breach

**Threat**: User trading activity is exposed, linking addresses to identities.

**Attack Vectors**:
- Transparent address usage
- Timing analysis
- Amount correlation
- IP address logging

**Mitigations**:
- ✅ Shielded-only by default (z-to-z transactions)
- ✅ Transparent flows blocked unless ALLOW_DESHIELD=true + KYC
- ✅ Users identified by viewing key hash, not PII
- ✅ No IP address logging in application layer
- ⚠️ TODO: Tor/I2P support for network-level privacy
- ⚠️ TODO: Amount obfuscation for similar transaction values

**Residual Risk**: Low (when using shielded transactions)

---

### 4. Service-to-Service Authentication Bypass

**Threat**: Attacker bypasses HMAC authentication to call internal APIs directly.

**Attack Vectors**:
- Weak HMAC secret
- Replay attacks
- Timing attacks on signature verification
- Network interception

**Mitigations**:
- ✅ HMAC-SHA256 with strong secret
- ✅ Timestamp validation (5-minute window)
- ✅ Constant-time signature comparison
- ⚠️ TODO: Mutual TLS (mTLS) for service mesh
- ⚠️ TODO: Network segmentation (internal services not exposed)

**Residual Risk**: Low (with proper secret management)

---

### 5. Smart Contract / AMM Manipulation

**Threat**: Attacker exploits AMM math to drain liquidity or manipulate prices.

**Attack Vectors**:
- Flash loan attacks (not applicable - no flash loans)
- Sandwich attacks
- Price manipulation via large trades
- Rounding errors in math

**Mitigations**:
- ✅ Constant product invariant enforced (x*y=k)
- ✅ BigInt math to prevent overflow
- ✅ Unit tests for AMM invariants
- ✅ Slippage protection (implicit in CPMM)
- ⚠️ TODO: Maximum trade size limits
- ⚠️ TODO: Price oracle integration for manipulation detection

**Residual Risk**: Low (CPMM is well-understood and battle-tested)

---

### 6. Database Compromise / SQL Injection

**Threat**: Attacker gains unauthorized database access or executes malicious SQL.

**Attack Vectors**:
- SQL injection via user input
- Exposed database credentials
- Unpatched database vulnerabilities
- Backup theft

**Mitigations**:
- ✅ Parameterized queries (prepared statements)
- ✅ Database credentials in environment variables
- ✅ Sensitive data stored as hashes (viewing keys)
- ⚠️ TODO: Database connection encryption (SSL)
- ⚠️ TODO: Row-level security policies
- ⚠️ TODO: Encrypted backups

**Residual Risk**: Low (with parameterized queries)

---

## Additional Threats (Lower Priority)

### 7. Denial of Service (DoS)
- **Mitigation**: Rate limiting, CDN, auto-scaling
- **Status**: TODO

### 8. Frontend XSS/CSRF
- **Mitigation**: CSP headers, CSRF tokens, input sanitization
- **Status**: TODO

### 9. Dependency Vulnerabilities
- **Mitigation**: Regular `npm audit`, Dependabot
- **Status**: Partially implemented

### 10. Insider Threat
- **Mitigation**: Least privilege, audit logging, code review
- **Status**: TODO

---

## Risk Matrix

| Threat | Likelihood | Impact | Risk Level | Status |
|--------|------------|--------|------------|--------|
| Private Key Compromise | Low | Critical | High | Mitigated |
| Oracle Manipulation | Medium | High | High | Partially Mitigated |
| Deanonymization | Low | High | Medium | Mitigated |
| Auth Bypass | Low | High | Medium | Mitigated |
| AMM Manipulation | Low | Medium | Low | Mitigated |
| Database Compromise | Low | Medium | Low | Mitigated |

---

## Incident Response

1. **Detection**: Monitor Prometheus alerts, log aggregation
2. **Containment**: Isolate affected services, rotate secrets
3. **Eradication**: Patch vulnerability, update dependencies
4. **Recovery**: Restore from backups, verify integrity
5. **Lessons Learned**: Post-mortem, update threat model

---

## Review Schedule

This threat model should be reviewed:
- After any security incident
- Before major releases
- Quarterly (minimum)
- When architecture changes significantly

