import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Address, type WalletClient } from "viem";
import { ActivityFeed } from "./components/ActivityFeed";
import { Backdrop } from "./components/Backdrop";
import { FlowCard } from "./components/FlowCard";
import { Header } from "./components/Header";
import { Stats } from "./components/Stats";
import { Mascot } from "./components/Mascot";
import { PendingList } from "./components/PendingList";
import { Rules } from "./components/Rules";
import { Summary } from "./components/Summary";
import { useActivity } from "./hooks/useActivity";
import { useGuard } from "./hooks/useGuard";
import { ERROR_TEXT, guardAbi } from "./lib/abi";
import { GUARD, publicClient, short, txUrl } from "./lib/chain";
import { connectWallet } from "./lib/wallet";

/** viem hatasından kısa, Türkçe bir mesaj çıkar (sözleşme revert'i ise adını çevir). */
function explain(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    if (name) return ERROR_TEXT[name] ?? name;
    return err.shortMessage;
  }
  return (err as Error).message;
}

export default function App() {
  const { state, error: stateError, refresh } = useGuard();
  const activity = useActivity();
  const [wallet, setWallet] = useState<{ client: WalletClient; account: Address } | null>(null);
  const [busyId, setBusyId] = useState<bigint | null>(null);
  const [notice, setNotice] = useState<{ text: string; tx?: `0x${string}`; bad?: boolean } | null>(null);

  const isOwner = !!wallet && !!state && wallet.account.toLowerCase() === state.owner.toLowerCase();

  async function onConnect() {
    try {
      setWallet(await connectWallet());
    } catch (err) {
      setNotice({ text: explain(err), bad: true });
    }
  }

  async function onDecide(id: bigint, approve: boolean) {
    if (!wallet) return;
    setBusyId(id);
    setNotice(null);
    try {
      // Önce simülasyon: revert edecekse (ör. bütçe dolmuş) cüzdan penceresi açılmadan sebebini göster
      const { request } = await publicClient.simulateContract({
        address: GUARD,
        abi: guardAbi,
        functionName: approve ? "approvePending" : "rejectPending",
        args: [id],
        account: wallet.account,
      });
      const hash = await wallet.client.writeContract(request);
      setNotice({ text: `#${id} için işlem gönderildi, onay bekleniyor…`, tx: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice({ text: `#${id} ${approve ? "onaylandı ve ödendi" : "reddedildi"}`, tx: hash });
      await refresh();
    } catch (err) {
      setNotice({ text: explain(err), bad: true });
    } finally {
      setBusyId(null);
    }
  }

  const openPending = state?.pendings.filter((p) => p.status === 1).length ?? 0;
  const lastDecision = activity.items.find((a) => ["Settled", "Rejected", "PendingCreated"].includes(a.kind))?.kind;

  return (
    <>
      <Backdrop />
      <div className="app">
      <Header account={wallet?.account ?? null} isOwner={isOwner} onConnect={onConnect} />

      {notice && (
        <div className={notice.bad ? "notice bad" : "notice"}>
          {notice.text}
          {notice.tx && (
            <a href={txUrl(notice.tx)} target="_blank" rel="noreferrer">
              {short(notice.tx)}
            </a>
          )}
        </div>
      )}
      {(stateError || activity.error) && <div className="notice bad">RPC hatası: {stateError ?? activity.error}</div>}

      <main className="grid">
        <div className="col col-left">
          <FlowCard items={activity.items} />
          {state && <Rules state={state} />}
        </div>
        <div className="col col-center">
          <Mascot live={!!state && !stateError} lastDecision={lastDecision} />
          {state && <Stats items={activity.items} openPending={openPending} />}
          {state && <PendingList pendings={state.pendings} canAct={isOwner} busyId={busyId} onDecide={onDecide} />}
        </div>
        <div className="col col-right">
          {state ? <Summary state={state} activity={activity.items} /> : <div className="card muted">Sözleşme okunuyor…</div>}
          <ActivityFeed items={activity.items} pendings={state?.pendings ?? []} loading={activity.loading} />
        </div>
      </main>
      </div>
    </>
  );
}
