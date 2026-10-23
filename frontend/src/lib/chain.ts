// Zincir bağlantısı, explorer linkleri ve adres/kategori etiketleri.
import { createPublicClient, defineChain, http, keccak256, toBytes, type Address, type Hex } from "viem";
import * as config from "../config";

export const GUARD = config.GUARD_ADDRESS as Address;
export const DEPLOY_BLOCK = config.DEPLOY_BLOCK;

export const monadTestnet = defineChain({
  id: config.CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [config.RPC_URL] } },
  blockExplorers: { default: { name: "MonadVision", url: "https://testnet.monadvision.com" } },
  // Birçok okumayı tek eth_call'da toplar: public RPC saniyede 15 istekle sınırlı
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

// batch: aynı anda yapılan okumalar tek HTTP isteğinde gider (public RPC'nin hız sınırına takılmamak için)
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(undefined, { batch: true }),
  pollingInterval: 1000,
});

const EXPLORER = "https://testnet.monadvision.com";
export const txUrl = (hash: Hex) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: Address) => `${EXPLORER}/address/${address}`;
export const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

// Servis adlarını göstermek için. SecureScan/LintBot deploy'dan gelir, diğerleri agent/services.js'teki payTo'lar.
const LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(config.PROVIDERS).map(([name, a]) => [a.toLowerCase(), name])),
  "0x03090b1309907c668acb68ec45413ac70f5b5255": "TestRunner Pro",
  "0xa338def760fe72f34fc431f4841a5bad7ce1591c": "GPU Burst",
  [config.AGENT_ADDRESS.toLowerCase()]: "Ajan",
};
export const KNOWN_PROVIDERS = Object.keys(LABELS).filter((a) => LABELS[a] !== "Ajan") as Address[];
export const labelOf = (address: string) => LABELS[address.toLowerCase()] ?? short(address);

// Zincirde kategori sadece keccak256 hash'i olarak durur: bilinen adları hash'leyip geri çeviriyoruz
export const KNOWN_CATEGORIES = [...config.SCOPE, "compute", "data", "ai", "gambling"];
const CATEGORY_BY_HASH = Object.fromEntries(KNOWN_CATEGORIES.map((c) => [keccak256(toBytes(c)), c]));
export const categoryHash = (name: string) => keccak256(toBytes(name));
export const categoryName = (hash: Hex) => CATEGORY_BY_HASH[hash] ?? short(hash);
