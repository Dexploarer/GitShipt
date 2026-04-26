import { Connection, type Commitment } from "@solana/web3.js";
import { serverEnv, hasCredentials } from "@/lib/env";

let _connection: Connection | null = null;

/**
 * Singleton Solana RPC connection. Uses Helius (env: HELIUS_RPC_URL) for
 * production reads and `https://api.devnet.solana.com` as a no-creds
 * fallback for local dev. Cluster is set on the URL itself; we don't
 * track it separately.
 */
export function solanaConnection(commitment: Commitment = "processed"): Connection {
  if (_connection) return _connection;
  const env = serverEnv();
  const url = env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
  _connection = new Connection(url, commitment);
  return _connection;
}

export function hasSolanaConnection(): boolean {
  return hasCredentials.solana();
}
