// İşlem akışı: sözleşme event'leri (Settled, Rejected, Pending*) → zaman sıralı liste.
// Monad RPC'leri eth_getLogs'u 100 blokla sınırlıyor; bu yüzden geçmişin tamamını değil,
// son ~15 dakikayı okuyup sonra yeni blokları canlı takip ediyoruz.
import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { guardAbi } from "../lib/abi";
import { DEPLOY_BLOCK, GUARD, publicClient } from "../lib/chain";

export type Activity = {
  key: string;
  kind: "Settled" | "Rejected" | "PendingCreated" | "PendingApproved" | "PendingRejected";
  txHash: Hex;
  blockNumber: bigint;
  time?: number; // saniye
  provider?: Address;
  amount?: bigint;
  category?: Hex;
  reason?: number;
  id?: bigint;
};

const MAX_RANGE = 100n; // RPC sınırı
const BACKFILL_BLOCKS = 2400n; // ~15 dk (Monad'da saniyede ~2.7 blok)
const POLL_MS = 1500;
const MAX_ITEMS = 200;

async function fetchRange(from: bigint, to: bigint): Promise<Activity[]> {
  const logs = await publicClient.getContractEvents({ address: GUARD, abi: guardAbi, fromBlock: from, toBlock: to });
  return logs.map((log) => {
    const args = log.args as Record<string, unknown>;
    return {
      key: `${log.transactionHash}-${log.logIndex}`,
      kind: log.eventName as Activity["kind"],
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      time: log.blockTimestamp ? Number(log.blockTimestamp) : undefined,
      provider: args.provider as Address | undefined,
      amount: args.amount as bigint | undefined,
      category: args.category as Hex | undefined,
      reason: args.reason as number | undefined,
      id: args.id as bigint | undefined,
    };
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** [from, to] aralığını 100'lük parçalara bölüp sırayla okur. */
async function fetchChunked(from: bigint, to: bigint): Promise<Activity[]> {
  const out: Activity[] = [];
  for (let start = from; start <= to; start += MAX_RANGE) {
    const end = start + MAX_RANGE - 1n < to ? start + MAX_RANGE - 1n : to;
    out.push(...(await fetchRange(start, end)));
    if (end < to) await sleep(150); // public RPC: saniyede en fazla 15 istek
  }
  return out;
}

export function useActivity() {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let next = 0n; // okunacak ilk blok

    const add = (found: Activity[]) => {
      if (found.length === 0) return;
      setItems((prev) => {
        const seen = new Set(prev.map((a) => a.key));
        const merged = [...found.filter((a) => !seen.has(a.key)), ...prev];
        merged.sort((a, b) => Number(b.blockNumber - a.blockNumber) || b.key.localeCompare(a.key));
        return merged.slice(0, MAX_ITEMS);
      });
    };

    async function run() {
      try {
        const latest = await publicClient.getBlockNumber();
        const start = latest - BACKFILL_BLOCKS > DEPLOY_BLOCK ? latest - BACKFILL_BLOCKS : DEPLOY_BLOCK;
        // Geçmişi yeniden eskiye doğru parça parça oku: en yeni işlemler ekrana önce gelsin
        for (let end = latest; end >= start && !stopped; end -= MAX_RANGE * 4n) {
          const from = end - MAX_RANGE * 4n + 1n > start ? end - MAX_RANGE * 4n + 1n : start;
          add(await fetchChunked(from, end));
        }
        next = latest + 1n;
      } catch (err) {
        setError((err as Error).message);
      }
      setLoading(false);

      while (!stopped) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        try {
          const latest = await publicClient.getBlockNumber();
          if (latest >= next) {
            add(await fetchChunked(next, latest));
            next = latest + 1n;
          }
          setError(null);
        } catch (err) {
          setError((err as Error).message); // geçici RPC hatası: bir sonraki turda tekrar dener
        }
      }
    }

    run();
    return () => {
      stopped = true;
    };
  }, []);

  return { items, loading, error };
}
