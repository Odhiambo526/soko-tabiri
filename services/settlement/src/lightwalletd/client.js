// Settlement Service - Lightwalletd Client
// Privacy: This is the ONLY module that interacts with Zcash network.
// Keys are accessed via KMS, never stored locally.

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let client = null;
let lightdInfo = null;
let connected = false;
let mockMode = false;

/**
 * Initialize lightwalletd client
 */
export async function initLightwalletd() {
  mockMode = process.env.MOCK_LIGHTWALLETD === 'true';
  
  if (mockMode) {
    console.log('🔧 Running in MOCK_LIGHTWALLETD mode');
    connected = true;
    lightdInfo = {
      version: 'mock-1.0.0',
      vendor: 'Soko Tabiri Mock',
      chainName: process.env.ZCASH_NETWORK === 'mainnet' ? 'main' : 'test',
      blockHeight: '2500000',
    };
    return;
  }

  const lightwalletdUrl = process.env.LIGHTWALLETD_URL || 'lightwalletd.testnet.electriccoin.co:9067';
  const [host, port] = lightwalletdUrl.split(':');

  const protoPath = path.join(__dirname, '../../proto/service.proto');
  
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const proto = grpc.loadPackageDefinition(packageDefinition);
  const service = proto.cash.z.wallet.sdk.rpc;

  const network = process.env.ZCASH_NETWORK || 'testnet';
  const credentials = network === 'testnet'
    ? grpc.credentials.createInsecure()
    : grpc.credentials.createSsl();

  client = new service.CompactTxStreamer(`${host}:${port}`, credentials);

  // Test connection
  lightdInfo = await getLightdInfo();
  connected = true;
  
  console.log(`   Chain: ${lightdInfo.chainName}`);
  console.log(`   Block Height: ${lightdInfo.blockHeight}`);
}

/**
 * Get lightwalletd server info
 */
export function getLightdInfo() {
  if (mockMode) {
    return Promise.resolve(lightdInfo);
  }

  return new Promise((resolve, reject) => {
    client.GetLightdInfo({}, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

/**
 * Get latest block height
 */
export function getLatestBlock() {
  if (mockMode) {
    return Promise.resolve({
      height: (parseInt(lightdInfo.blockHeight) + Math.floor(Math.random() * 10)).toString(),
    });
  }

  return new Promise((resolve, reject) => {
    client.GetLatestBlock({}, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

/**
 * Submit a raw transaction
 * Privacy: Transaction must be pre-signed. Keys accessed via KMS.
 */
export function sendTransaction(rawTxData) {
  if (mockMode) {
    // Generate mock tx hash
    const mockHash = Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return Promise.resolve({
      errorCode: 0,
      errorMessage: '',
      txHash: mockHash,
    });
  }

  return new Promise((resolve, reject) => {
    client.SendTransaction({ data: rawTxData }, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

/**
 * Get transaction by hash
 */
export function getTransaction(txHash) {
  if (mockMode) {
    return Promise.resolve({
      data: Buffer.alloc(0),
      height: lightdInfo.blockHeight,
    });
  }

  return new Promise((resolve, reject) => {
    client.GetTransaction({ hash: Buffer.from(txHash, 'hex') }, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

/**
 * Get connection status
 */
export function getConnectionStatus() {
  return {
    connected,
    mockMode,
    lightdInfo,
    network: process.env.ZCASH_NETWORK || 'testnet',
    lightwalletdUrl: process.env.LIGHTWALLETD_URL || 'lightwalletd.testnet.electriccoin.co:9067',
  };
}

/**
 * Validate a Zcash address
 */
export function validateAddress(address) {
  if (!address) return { valid: false, type: null, network: null };

  // Testnet transparent
  if (address.startsWith('tm')) {
    return { valid: true, type: 'transparent', network: 'testnet' };
  }
  // Mainnet transparent
  if (address.startsWith('t1') || address.startsWith('t3')) {
    return { valid: true, type: 'transparent', network: 'mainnet' };
  }
  // Testnet shielded (Sapling)
  if (address.startsWith('ztestsapling')) {
    return { valid: true, type: 'shielded', network: 'testnet' };
  }
  // Mainnet shielded (Sapling)
  if (address.startsWith('zs')) {
    return { valid: true, type: 'shielded', network: 'mainnet' };
  }
  // Unified addresses (NU5+)
  if (address.startsWith('u1') || address.startsWith('utest')) {
    return { valid: true, type: 'unified', network: address.startsWith('utest') ? 'testnet' : 'mainnet' };
  }

  return { valid: false, type: null, network: null };
}

export default {
  initLightwalletd,
  getLightdInfo,
  getLatestBlock,
  sendTransaction,
  getTransaction,
  getConnectionStatus,
  validateAddress,
};

