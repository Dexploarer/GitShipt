import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const PUBKEY = process.argv[2];
const SOL = Number(process.argv[3] ?? 5);

if (!PUBKEY) {
  console.error("Usage: node scripts/airdrop-devnet.mjs <pubkey> [sol=5]");
  process.exit(1);
}

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const pk = new PublicKey(PUBKEY);

console.log(`Requesting airdrop: ${SOL} SOL → ${PUBKEY}`);
const sig = await conn.requestAirdrop(pk, SOL * LAMPORTS_PER_SOL);
console.log(`Signature: ${sig}`);

await conn.confirmTransaction(sig, "confirmed");
const balance = await conn.getBalance(pk);
console.log(`Confirmed. Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
console.log(`Solscan: https://solscan.io/account/${PUBKEY}?cluster=devnet`);
