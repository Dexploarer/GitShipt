export type SolanaCluster = "devnet" | "testnet" | "mainnet-beta";

export function currentSolanaCluster(): SolanaCluster {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  if (cluster === "testnet" || cluster === "mainnet-beta") return cluster;
  return "devnet";
}

export function solscanClusterSuffix(
  cluster: SolanaCluster = currentSolanaCluster(),
): string {
  return cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
}

export function solscanAddressUrl(
  address: string,
  cluster: SolanaCluster = currentSolanaCluster(),
): string {
  return `https://solscan.io/account/${address}${solscanClusterSuffix(cluster)}`;
}

export function solscanTokenUrl(
  tokenMint: string,
  cluster: SolanaCluster = currentSolanaCluster(),
): string {
  return `https://solscan.io/token/${tokenMint}${solscanClusterSuffix(cluster)}`;
}

export function solscanTxUrl(
  signature: string,
  cluster: SolanaCluster = currentSolanaCluster(),
): string {
  return `https://solscan.io/tx/${signature}${solscanClusterSuffix(cluster)}`;
}

export function clusterLabel(
  cluster: SolanaCluster = currentSolanaCluster(),
): string {
  return cluster === "mainnet-beta" ? "mainnet" : cluster;
}
