// Son ödeme isteğinin yolculuğu: servis 402 döner → ajan requestPayment → AgentGuard karar verir.
import type { Activity } from "../hooks/useActivity";
import { REJECT_REASONS } from "../lib/abi";
import { categoryName, labelOf, short, txUrl } from "../lib/chain";
import { mon } from "../lib/format";

const DECISION: Record<string, { text: string; tone: string }> = {
  Settled: { text: "Settled · ödendi", tone: "ok" },
  PendingCreated: { text: "Pending · owner onayı", tone: "warn" },
  Rejected: { text: "Rejected · engellendi", tone: "bad" },
};

export function FlowCard({ items }: { items: Activity[] }) {
  // Akıştaki en yeni "karar" event'i (PendingApproved/Rejected sonradan gelir, karar değil)
  const last = items.find((a) => a.kind in DECISION);

  return (
    <section className="card">
      <h2 className="card-title">
        <span className="icon">⇄</span> x402 ödeme akışı
      </h2>
      {!last ? (
        <p className="muted">Henüz istek yok. Ajanı çalıştırınca burada canlı görünecek.</p>
      ) : (
        <ol className="flow">
          <li>
            <span className="flow-label">HTTP isteği</span>
            <code>
              POST /{labelOf(last.provider!).toLowerCase().replace(/\s+/g, "")}
            </code>
          </li>
          <li>
            <span className="flow-label">Servis cevabı</span>
            <div className="flow-402">
              <strong>402</strong> Payment Required
              <div className="muted">
                {mon(last.amount!)} · {categoryName(last.category!)}
              </div>
            </div>
          </li>
          <li>
            <span className="flow-label">AgentGuard kararı</span>
            <span className={`pill ${DECISION[last.kind].tone}`}>{DECISION[last.kind].text}</span>
            {last.reason !== undefined && <div className="bad-text">{REJECT_REASONS[last.reason]}</div>}
          </li>
          <li>
            <span className="flow-label">Zincir kaydı</span>
            <a href={txUrl(last.txHash)} target="_blank" rel="noreferrer">
              {short(last.txHash)} ↗
            </a>
          </li>
        </ol>
      )}
    </section>
  );
}
