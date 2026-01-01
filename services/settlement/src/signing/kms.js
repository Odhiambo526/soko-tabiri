// Settlement Service - KMS/HSM Key Management
// Privacy: Keys are NEVER stored locally. All signing via KMS/HSM.
//
// Supported providers:
// - aws-kms: AWS Key Management Service
// - gcp-kms: Google Cloud KMS
// - azure-keyvault: Azure Key Vault
// - hashicorp-vault: HashiCorp Vault
// - mock: Mock provider for local development

const KMS_PROVIDER = process.env.KMS_PROVIDER || 'mock';
const KMS_KEY_ID = process.env.KMS_KEY_ID;

/**
 * Sign data using KMS
 * @param {Buffer} data - Data to sign
 * @param {string} keyId - KMS key identifier (optional, uses default)
 * @returns {Promise<Buffer>} Signature
 */
export async function sign(data, keyId = KMS_KEY_ID) {
  switch (KMS_PROVIDER) {
    case 'aws-kms':
      return signWithAwsKms(data, keyId);
    case 'gcp-kms':
      return signWithGcpKms(data, keyId);
    case 'azure-keyvault':
      return signWithAzureKeyVault(data, keyId);
    case 'hashicorp-vault':
      return signWithVault(data, keyId);
    case 'mock':
    default:
      return signMock(data, keyId);
  }
}

/**
 * Get public key from KMS
 * @param {string} keyId - KMS key identifier
 * @returns {Promise<Buffer>} Public key
 */
export async function getPublicKey(keyId = KMS_KEY_ID) {
  switch (KMS_PROVIDER) {
    case 'aws-kms':
      return getPublicKeyFromAwsKms(keyId);
    case 'gcp-kms':
      return getPublicKeyFromGcpKms(keyId);
    case 'azure-keyvault':
      return getPublicKeyFromAzureKeyVault(keyId);
    case 'hashicorp-vault':
      return getPublicKeyFromVault(keyId);
    case 'mock':
    default:
      return getPublicKeyMock(keyId);
  }
}

// =============================================================================
// MOCK PROVIDER (for local development)
// =============================================================================

import crypto from 'crypto';

// Mock key pair (NEVER use in production)
const mockKeyPair = crypto.generateKeyPairSync('ed25519');

async function signMock(data, keyId) {
  console.warn('⚠️  Using MOCK KMS provider - NOT FOR PRODUCTION');
  return crypto.sign(null, data, mockKeyPair.privateKey);
}

async function getPublicKeyMock(keyId) {
  console.warn('⚠️  Using MOCK KMS provider - NOT FOR PRODUCTION');
  return mockKeyPair.publicKey.export({ type: 'spki', format: 'der' });
}

// =============================================================================
// AWS KMS (placeholder - implement when needed)
// =============================================================================

async function signWithAwsKms(data, keyId) {
  // TODO: Implement AWS KMS signing
  // ASSUMPTION: @aws-sdk/client-kms package would be used
  throw new Error('AWS KMS not implemented - set KMS_PROVIDER=mock for development');
}

async function getPublicKeyFromAwsKms(keyId) {
  throw new Error('AWS KMS not implemented');
}

// =============================================================================
// GCP KMS (placeholder - implement when needed)
// =============================================================================

async function signWithGcpKms(data, keyId) {
  // TODO: Implement GCP KMS signing
  // ASSUMPTION: @google-cloud/kms package would be used
  throw new Error('GCP KMS not implemented - set KMS_PROVIDER=mock for development');
}

async function getPublicKeyFromGcpKms(keyId) {
  throw new Error('GCP KMS not implemented');
}

// =============================================================================
// Azure Key Vault (placeholder - implement when needed)
// =============================================================================

async function signWithAzureKeyVault(data, keyId) {
  // TODO: Implement Azure Key Vault signing
  // ASSUMPTION: @azure/keyvault-keys package would be used
  throw new Error('Azure Key Vault not implemented - set KMS_PROVIDER=mock for development');
}

async function getPublicKeyFromAzureKeyVault(keyId) {
  throw new Error('Azure Key Vault not implemented');
}

// =============================================================================
// HashiCorp Vault (placeholder - implement when needed)
// =============================================================================

async function signWithVault(data, keyId) {
  // TODO: Implement HashiCorp Vault signing
  // ASSUMPTION: node-vault package would be used
  throw new Error('HashiCorp Vault not implemented - set KMS_PROVIDER=mock for development');
}

async function getPublicKeyFromVault(keyId) {
  throw new Error('HashiCorp Vault not implemented');
}

export default { sign, getPublicKey };

