import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "node:fs";
import path from "node:path";

const kp = Keypair.generate();
const pubkey = kp.publicKey.toBase58();
const secretBs58 = bs58.encode(kp.secretKey);

const keypairPath = path.join(process.cwd(), ".payout-keypair.json");
fs.writeFileSync(keypairPath, JSON.stringify(Array.from(kp.secretKey)));

console.log("Generated devnet payout keypair");
console.log("--------------------------------");
console.log("PUBKEY:    ", pubkey);
console.log("SECRET_B58:", secretBs58);
console.log("");
console.log("Written to:", keypairPath, "(gitignored)");
console.log("");
console.log("Next steps:");
console.log("  1. Paste SECRET_B58 into .env.local as SOLANA_PAYOUT_KEYPAIR");
console.log("  2. Add the same value to Vercel env, marked Sensitive");
console.log("  3. Airdrop devnet SOL: solana airdrop 5", pubkey, "-u devnet");
console.log("  4. Track on Solscan: https://solscan.io/account/" + pubkey + "?cluster=devnet");
