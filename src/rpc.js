const axios = require('axios');
require('dotenv').config();

class BadcoinRPC {
  constructor() {
    this.url = `http://${process.env.RPC_HOST}:${process.env.RPC_PORT}`;
    this.auth = {
      username: process.env.RPC_USER,
      password: process.env.RPC_PASSWORD
    };
    this.requestId = 0;
  }

  async call(method, params = []) {
    try {
      const response = await axios.post(
        this.url,
        {
          jsonrpc: '1.0',
          id: ++this.requestId,
          method,
          params
        },
        {
          auth: this.auth,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return response.data.result;
    } catch (error) {
      if (error.response) {
        throw new Error(`RPC Error: ${error.response.data.error.message}`);
      }
      throw error;
    }
  }

  // Blockchain methods
  async getBlockchainInfo() {
    return this.call('getblockchaininfo');
  }

  async getBlockCount() {
    return this.call('getblockcount');
  }

  async getBlockHash(height) {
    return this.call('getblockhash', [height]);
  }

  async getBlock(hash, verbosity = 2) {
    return this.call('getblock', [hash, verbosity]);
  }

  async getRawTransaction(txid, verbose = true) {
    return this.call('getrawtransaction', [txid, verbose]);
  }

  async getNetworkInfo() {
    return this.call('getnetworkinfo');
  }

  async getMempoolInfo() {
    return this.call('getmempoolinfo');
  }

  async getRawMempool() {
    return this.call('getrawmempool');
  }

  async getDifficulty() {
    return this.call('getdifficulty');
  }

  async getNetworkHashps(nblocks = 120, height = -1) {
    return this.call('getnetworkhashps', [nblocks, height]);
  }

  // Utility methods
  async getConnectionCount() {
    return this.call('getconnectioncount');
  }
}

module.exports = new BadcoinRPC();
