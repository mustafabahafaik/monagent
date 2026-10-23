import { useEffect, useRef, useState, type ReactNode } from "react";
import { BaseError, ContractFunctionRevertedError, type Address, type WalletClient } from "viem";
import { ActivityFeed } from "./components/ActivityFeed";
import { Backdrop } from "./components/Backdrop";
import { FlowCard } from "./components/FlowCard";
import { Header } from "./components/Header";
import { Mascot, type Reaction } from "./components/Mascot";
import { OrbitCard, type Slot } from "./components/OrbitCard";
import { PendingList } from "./components/PendingList";
import { Rules } from "./components/Rules";
import { Stats } from "./components/Stats";
import { Summary } from "./components/Summary";
import { useActivity } from "./hooks/useActivity";
import { useGuard } from "./hooks/useGuard";
import { ERROR_TEXT, guardAbi } from "./lib/abi";
import { GUARD, publicClient, short, txUrl } from "./lib/chain";
import { mon } from "./lib/format";
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

// Kapsüllerin maskot etrafındaki yerleri. Ortadakiler kenara daha yakın (inset küçük) → yay etkisi.
// Genişlik, eğim ve yüzme gecikmesi bilerek farklı: hepsi aynı hizada durmasın.
const SLOTS: Record<string, Slot> = {
  flow: { side: "left", top: "4%", inset: "8%", width: 250, tilt: -1.5, delay: 0 },
  rules: { side: "left", top: "37%", inset: "1.5%", width: 258, tilt: 1, delay: 1.2 },
  pending: { side: "left", top: "70%", inset: "6%", width: 244, tilt: -0.8, delay: 2.1 },
  summary: { side: "right", top: "8%", inset: "6.5%", width: 240, tilt: 1.2, delay: 0.6 },
  feed: { side: "right", top: "40%", inset: "0.5%", width: 256, tilt: -1, delay: 1.6 },
  stats: { side: "right", top: "72%", inset: "8%", width: 226, tilt: 0.8, delay: 2.6 },
};

const DECISION_TEXT: Record<string, string> = { Settled: "Settled", PendingCreated: "Pending", Rejected: "Rejected" };
const bare = (wei: bigint) => mon(wei).replace(" MON", "");

export default function App() {
  const { state, error: stateError, refresh } = useGuard();
  const activity = useActivity();
  const [wallet, setWallet] = useState<{ client: WalletClient; account: Address } | null>(null);
  const [busyId, setBusyId] = useState<bigint | null>(null);
  const [notice, setNotice] = useState<{ text: string; tx?: `0x${string}`; bad?: boolean } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const seen = useRef(new Set<string>());

  const isOwner = !!wallet && !!state && wallet.account.toLowerCase() === state.owner.toLowerCase();

  // Tek kart açık: ESC veya kartın dışına tıklama kapatır
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".capsule.open, .capsule-head")) setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [openId]);

  // Maskotun tepkisi: geçmiş yüklenirken gelenler sayılmaz, sadece canlı gelen yeni event'ler
  useEffect(() => {
    const fresh = activity.items.filter((a) => !seen.current.has(a.key));
    fresh.forEach((a) => seen.current.add(a.key));
    if (activity.loading || fresh.length === 0) return;
    const newest = fresh.find((a) => a.kind !== "PendingCreated"); // liste yeniden eskiye sıralı
    if (!newest) return;
    const kind = newest.kind === "Settled" || newest.kind === "PendingApproved" ? "approve" : "reject";
    setReaction((prev) => ({ kind, n: (prev?.n ?? 0) + 1 }));
  }, [activity.items, activity.loading]);

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

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const openPending = state?.pendings.filter((p) => p.status === 1).length ?? 0;
  const lastDecision = activity.items.find((a) => a.kind in DECISION_TEXT)?.kind;
  const settled = activity.items.filter((a) => a.kind === "Settled").length;
  const failed = activity.items.filter((a) => a.kind === "Rejected" || a.kind === "PendingRejected").length;
  const loadingText = "okunuyor…";

  const card = (id: string, icon: string, title: string, summary: ReactNode, body: ReactNode, tone?: "warn") => (
    <OrbitCard key={id} id={id} icon={icon} title={title} summary={summary} tone={tone} slot={SLOTS[id]} open={openId === id} onToggle={toggle}>
      {body}
    </OrbitCard>
  );

  const openSide = openId ? SLOTS[openId].side : null;

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

        <main className={`stage${openSide ? ` stage-open-${openSide}` : ""}`}>
          <div className="stage-center">
            <Mascot reaction={reaction} pending={openPending > 0} />
            <div className="hero-caption">
              <h1>MONAGENT</h1>
              <p>Yapay zekâ ajanlarının harcama yetkisini zincirde denetleyen güvenlik katmanı</p>
              <div className="hero-status">
                <span className={state && !stateError ? "live-dot" : "live-dot off"} />
                {state && !stateError ? "Monad Testnet canlı izleniyor" : "Bağlanıyor…"}
              </div>
            </div>
          </div>

          {card("flow", "⇄", "x402 akışı", lastDecision ? `402 → ${DECISION_TEXT[lastDecision]}` : "istek bekleniyor", <FlowCard items={activity.items} />)}
          {card(
            "rules",
            "⛨",
            "Kurallar",
            state ? `${bare(state.perTxLimit)} / işlem · ${state.providers.filter((p) => p.allowed).length} servis` : loadingText,
            state && <Rules state={state} />,
          )}
          {card(
            "pending",
            "⏳",
            "Onay bekleyenler",
            state ? (openPending > 0 ? `${openPending} onay bekliyor` : "bekleyen yok") : loadingText,
            state && <PendingList pendings={state.pendings} canAct={isOwner} busyId={busyId} onDecide={onDecide} />,
            openPending > 0 ? "warn" : undefined,
          )}
          {card(
            "summary",
            "◔",
            "Harcama",
            state ? `${bare(state.spent)} / ${mon(state.totalBudget)}` : loadingText,
            state && <Summary state={state} activity={activity.items} />,
          )}
          {card(
            "feed",
            "≋",
            "İşlem akışı",
            activity.loading && activity.items.length === 0 ? loadingText : `${activity.items.length} kayıt`,
            <ActivityFeed items={activity.items} pendings={state?.pendings ?? []} loading={activity.loading} />,
          )}
          {card(
            "stats",
            "◎",
            "Kararlar",
            settled + failed === 0 ? "henüz karar yok" : `%${Math.round((settled / (settled + failed)) * 100)} başarı`,
            <Stats items={activity.items} openPending={openPending} />,
          )}
        </main>
      </div>
    </>
  );
}
