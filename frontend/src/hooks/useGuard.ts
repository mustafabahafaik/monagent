// Sözleşme durumu: limitler, harcama, kasa, allowlist, kapsam ve bekleyen ödemeler.
// Hepsi doğrudan storage'dan okunur → event geçmişine bağlı değil, her zaman tam doğru.
import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { guardAbi } from "../lib/abi";
import { GUARD, KNOWN_CATEGORIES, KNOWN_PROVIDERS, categoryHash, publicClient } from "../lib/chain";

export type PendingItem = {
  id: bigint;
  provider: Address;
  amount: bigint;
  category: Hex;
  purposeHash: Hex;
  status: number; // 1 bekliyor, 2 onaylandı, 3 reddedildi
};

export type GuardState = {
  owner: Address;
  agent: Address;
  perTxLimit: bigint;
  totalBudget: bigint;
  spent: bigint;
  remaining: bigint;
  balance: bigint;
  providers: { address: Address; allowed: boolean }[];
  categories: { name: string; allowed: boolean }[];
  pendings: PendingItem[];
};

const REFRESH_MS = 3000;

// Multicall3: listedeki tüm okumalar tek eth_call'da gider. allowFailure: false → biri hata verirse hepsi atar.
const call = (functionName: string, args: unknown[] = []) => ({ address: GUARD, abi: guardAbi, functionName, args }) as const;
const multicall = (contracts: ReturnType<typeof call>[]) =>
  publicClient.multicall({ contracts: contracts as never, allowFailure: false }) as Promise<unknown[]>;

async function readState(): Promise<GuardState> {
  const [[owner, agent, perTxLimit, totalBudget, spent, remaining, pendingCount], balance] = (await Promise.all([
    multicall(["owner", "agent", "perTxLimit", "totalBudget", "spent", "remainingBudget", "pendingCount"].map((f) => call(f))),
    publicClient.getBalance({ address: GUARD }),
  ])) as [[Address, Address, bigint, bigint, bigint, bigint, bigint], bigint];

  // İkinci tur: kaç pending olduğunu ilk turda öğrendik
  const ids = Array.from({ length: Number(pendingCount) }, (_, i) => BigInt(i + 1));
  const results = await multicall([
    ...ids.map((id) => call("pending", [id])),
    ...KNOWN_PROVIDERS.map((a) => call("allowedProvider", [a])),
    ...KNOWN_CATEGORIES.map((c) => call("allowedCategory", [categoryHash(c)])),
  ]);
  const pendingRows = results.slice(0, ids.length) as (readonly [Address, bigint, Hex, Hex, number])[];
  const providerFlags = results.slice(ids.length, ids.length + KNOWN_PROVIDERS.length) as boolean[];
  const categoryFlags = results.slice(ids.length + KNOWN_PROVIDERS.length) as boolean[];

  return {
    owner,
    agent,
    perTxLimit,
    totalBudget,
    spent,
    remaining,
    balance,
    providers: KNOWN_PROVIDERS.map((address, i) => ({ address, allowed: providerFlags[i] })),
    categories: KNOWN_CATEGORIES.map((name, i) => ({ name, allowed: categoryFlags[i] })),
    pendings: pendingRows.map(([provider, amount, category, purposeHash, status], i) => ({
      id: ids[i],
      provider,
      amount,
      category,
      purposeHash,
      status,
    })),
  };
}

export function useGuard() {
  const [state, setState] = useState<GuardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await readState());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { state, error, refresh };
}
