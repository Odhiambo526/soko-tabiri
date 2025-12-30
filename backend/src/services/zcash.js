import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Zcash Light Client Service
 * Connects to lightwalletd for blockchain interaction
 * Reference: https://zcash.readthedocs.io/en/latest/rtd_pages/lightclient_support.html
 */
class ZcashService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.network = process.env.ZCASH_NETWORK || 'testnet';
    this.lightdInfo = null;
  }

  async init(host, port) {
    const protoPath = path.join(__dirname, '../../proto/service.proto');
    
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const proto = grpc.loadPackageDefinition(packageDefinition);
    const service = proto.cash.z.wallet.sdk.rpc;

    // Connect to lightwalletd
    const address = `${host}:${port}`;
    
    // Use insecure for testnet, TLS for mainnet
    const credentials = this.network === 'testnet' 
      ? grpc.credentials.createInsecure()
      : grpc.credentials.createSsl();

    this.client = new service.CompactTxStreamer(address, credentials);

    try {
      // Test connection
      this.lightdInfo = await this.getLightdInfo();
      this.connected = true;
      console.log(`✅ Connected to Zcash ${this.network} lightwalletd`);
      console.log(`   Chain: ${this.lightdInfo.chainName}`);
      console.log(`   Block Height: ${this.lightdInfo.blockHeight}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Could not connect to lightwalletd: ${error.message}`);
      console.log('   Running in offline/mock mode');
      this.connected = false;
      return false;
    }
  }

  // Get lightwalletd server info
  getLightdInfo() {
    return new Promise((resolve, reject) => {
      this.client.GetLightdInfo({}, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  // Get latest block height
  getLatestBlock() {
    return new Promise((resolve, reject) => {
      this.client.GetLatestBlock({}, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  // Get a specific block
  getBlock(height) {
    return new Promise((resolve, reject) => {
      this.client.GetBlock({ height }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  // Get transaction by hash
  getTransaction(txHash) {
    return new Promise((resolve, reject) => {
      this.client.GetTransaction({ hash: Buffer.from(txHash, 'hex') }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  // Submit a raw transaction
  sendTransaction(rawTxData) {
    return new Promise((resolve, reject) => {
      this.client.SendTransaction({ data: rawTxData }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  // Get UTXOs for transparent addresses
  getAddressUtxos(addresses, startHeight = 0) {
    return new Promise((resolve, reject) => {
      this.client.GetAddressUtxos({ 
        addresses, 
        startHeight,
        maxEntries: 1000 
      }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  // Stream blocks in a range (for syncing)
  async *streamBlocks(startHeight, endHeight) {
    const call = this.client.GetBlockRange({
      start: { height: startHeight },
      end: { height: endHeight }
    });

    for await (const block of call) {
      yield block;
    }
  }

  /**
   * Generate a testnet address for receiving funds
   * In production, this would use proper key derivation
   * For testnet demo, we generate deterministic addresses
   */
  generateTestnetAddress(userId) {
    // Generate deterministic transparent address for demo
    // Real implementation would use HD wallet derivation
    const hash = crypto.createHash('sha256').update(userId + 'soko-tabiri').digest('hex');
    
    // Testnet transparent addresses start with 'tm'
    const tAddress = `tm${hash.substring(0, 32)}`;
    
    // Testnet shielded (Sapling) addresses start with 'ztestsapling'
    const zAddress = `ztestsapling1${hash.substring(0, 60)}`;
    
    // Viewing key (for read-only access)
    const viewingKey = `zxviews1${hash.substring(0, 64)}`;

    return {
      transparent: tAddress,
      shielded: zAddress,
      viewingKey
    };
  }

  /**
   * Convert ZEC to zatoshi (smallest unit)
   * 1 ZEC = 100,000,000 zatoshi
   */
  zecToZat(zec) {
    return Math.round(zec * 100000000);
  }

  /**
   * Convert zatoshi to ZEC
   */
  zatToZec(zat) {
    return zat / 100000000;
  }

  /**
   * Validate a Zcash address
   */
  validateAddress(address) {
    if (!address) return { valid: false, type: null };

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

    return { valid: false, type: null };
  }

  /**
   * Get current network status
   */
  async getNetworkStatus() {
    if (!this.connected) {
      return {
        connected: false,
        network: this.network,
        blockHeight: 0,
        message: 'Running in offline mode'
      };
    }

    try {
      const block = await this.getLatestBlock();
      return {
        connected: true,
        network: this.network,
        blockHeight: parseInt(block.height),
        chainName: this.lightdInfo?.chainName
      };
    } catch (error) {
      return {
        connected: false,
        network: this.network,
        error: error.message
      };
    }
  }

  /**
   * Mock faucet for testnet - credits test ZEC to user
   * In real testnet, you'd use: https://faucet.testnet.z.cash/
   */
  async requestTestnetFaucet(userId, amountZec = 1.0) {
    // This simulates receiving testnet ZEC
    // Real implementation would watch for incoming transactions
    const amountZat = this.zecToZat(amountZec);
    
    return {
      success: true,
      amount_zat: amountZat,
      amount_zec: amountZec,
      message: `Credited ${amountZec} testnet ZEC. In production, use https://faucet.testnet.z.cash/`,
      tx_hash: crypto.randomBytes(32).toString('hex')
    };
  }
}

export default new ZcashService();

