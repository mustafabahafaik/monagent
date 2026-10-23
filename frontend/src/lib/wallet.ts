// Tarayıcı cüzdanı (MetaMask, Rabby...) ile bağlantı. wagmi yerine doğrudan viem: daha az soyutlama.
import { createWalletClient, custom, numberToHex, type Address, type EIP1193Provider, type WalletClient } from "viem";
import { monadTestnet } from "./chain";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export async function connectWallet(): Promise<{ client: WalletClient; account: Address }> {
  if (!window.ethereum) throw new Error("Tarayıcıda cüzdan bulunamadı (MetaMask veya Rabby kur).");
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
  await ensureMonad(window.ethereum);
  const client = createWalletClient({ account, chain: monadTestnet, transport: custom(window.ethereum) });
  return { client, account };
}

/** Cüzdan başka ağdaysa Monad Testnet'e geçir; ağ cüzdanda hiç yoksa ekle. */
async function ensureMonad(provider: EIP1193Provider) {
  const chainId = numberToHex(monadTestnet.id);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (err) {
    if ((err as { code?: number }).code !== 4902) throw err; // 4902 = cüzdan bu ağı tanımıyor
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: monadTestnet.name,
          nativeCurrency: monadTestnet.nativeCurrency,
          rpcUrls: monadTestnet.rpcUrls.default.http,
          blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
        },
      ],
    });
  }
}
