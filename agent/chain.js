// Ortak zincir bağlantısı: services.js ve agent.js ikisi de buradan alır.
import { createPublicClient, createWalletClient, defineChain, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as config from "./config.js";

// agent/.env'i yükle. Komut satırında verilen değişkenler .env'dekileri ezer.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch {
  // .env yoksa sadece ortam değişkenleriyle çalış
}

export const GUARD_ADDRESS = process.env.GUARD_ADDRESS ?? config.GUARD_ADDRESS;
export const RPC_URL = process.env.RPC_URL ?? config.RPC_URL;
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? config.CHAIN_ID);

if (/^0x0{40}$/.test(GUARD_ADDRESS)) {
  throw new Error("GUARD_ADDRESS sıfır: önce contracts/ içinde Deploy.s.sol'u --broadcast ile çalıştır.");
}

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 10143 ? "Monad Testnet" : "Yerel",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// Monad'da blok ~0.4 sn: varsayılan 4 sn'lik yoklama aralığı gereksiz yavaş olur
export const publicClient = createPublicClient({ chain, transport: http(), pollingInterval: 500 });

export function walletClientFor(privateKey) {
  return createWalletClient({ account: privateKeyToAccount(privateKey), chain, transport: http() });
}

/** Solidity'deki keccak256(bytes("security")) ile aynı değeri verir. */
export const categoryHash = (name) => keccak256(toBytes(name));

export const txLink = (hash) =>
  CHAIN_ID === 10143 ? `https://testnet.monadvision.com/tx/${hash}` : hash;
