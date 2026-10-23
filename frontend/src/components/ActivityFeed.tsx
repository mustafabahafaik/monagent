// Canlı işlem akışı: her event bir satır, tx hash explorer linki.
import type { Activity } from "../hooks/useActivity";
import type { PendingItem } from "../hooks/useGuard";
import { REJECT_REASONS } from "../lib/abi";
import { categoryName, labelOf, short, txUrl } from "../lib/chain";
import { clock, mon } from "../lib/format";

const KIND: Record<Activity["kind"], { text: string; tone: string }> = {
  Settled: { text: "Ödendi", tone: "ok" },
  Rejected: { text: "Reddedildi", tone: "bad" },
  PendingCreated: { text: "Onay bekliyor", tone: "warn" },
  PendingApproved: { text: "Owner onayladı", tone: "ok" },
  PendingRejected: { text: "Owner reddetti", tone: "bad" },
};

type Props = { items: Activity[]; pendings: PendingItem[]; loading: boolean };

export function ActivityFeed({ items, pendings, loading }: Props) {
  return (
    <section className="card">
      <h2 className="card-title">
        <span className="icon">≋</span> İşlem akışı <span className="live-dot" />
      </h2>
      {loading && items.length === 0 && <p className="muted">Son event'ler okunuyor…</p>}
      {!loading && items.length === 0 && <p className="muted">Son 15 dakikada işlem yok. Ajanı çalıştır.</p>}
      <ul className="feed">
        {items.map((a) => {
          // PendingApproved/Rejected event'inde sadece id var: servis ve tutarı pending kaydından tamamla
          const p = a.id !== undefined ? pendings.find((x) => x.id === a.id) : undefined;
          const provider = a.provider ?? p?.provider;
          const amount = a.amount ?? p?.amount;
          const category = a.category ?? p?.category;
          return (
            <li key={a.key}>
              <span className={`dot ${KIND[a.kind].tone}`} />
              <div className="grow">
                <div>
                  <strong>{KIND[a.kind].text}</strong>
                  {provider && <> · {labelOf(provider)}</>}
                  {amount !== undefined && <> · {mon(amount)}</>}
                  {category && <span className="muted"> · {categoryName(category)}</span>}
                  {a.id !== undefined && <span className="muted"> · #{String(a.id)}</span>}
                </div>
                {a.reason !== undefined && <div className="bad-text">{REJECT_REASONS[a.reason]}</div>}
              </div>
              <div className="right">
                <a href={txUrl(a.txHash)} target="_blank" rel="noreferrer">
                  {short(a.txHash)}
                </a>
                <div className="muted">{clock(a.time)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
