import { createPublicClient, http, type PublicClient } from "viem";
import { ronin } from "viem/chains";

export class RpcRequest {
  private publicClient!: PublicClient;
  private connected!: boolean;

  private async connect() {
    if (this.connected && this.publicClient) return;

    const envRpcUrl = process.env.RPC_URL;
    if (!envRpcUrl) {
      throw new Error("No RPC URL provided");
    }

    const skyMavisAPIKey = process.env.SKYMAVIS_API_KEY;
    if (!skyMavisAPIKey) {
      throw Error("SKYMAVIS_API_KEY is not set");
    }
    this.publicClient = createPublicClient({
      chain: ronin,
      transport: http(envRpcUrl, {
        fetchOptions: {
          headers: {
            "x-api-key": skyMavisAPIKey,
          },
        },
        timeout: 10 * 60 * 1000,
      }),
    });

    this.connected = true;
  }

  private promise: Promise<void> | null = null;
  private async checkConnection(): Promise<void> {
    if (!this.promise) {
      this.promise = this.checkConnectionOnce();
    }
    return this.promise;
  }

  private async checkConnectionOnce(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.connect();
  }

  async getPublicClient(): Promise<PublicClient> {
    await this.checkConnection();

    return this.publicClient;
  }
}

const rpcRequest = new RpcRequest();

export default rpcRequest;
