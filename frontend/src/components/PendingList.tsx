// Owner onayı bekleyen ödemeler: Onayla → approvePending, Reddet → rejectPending.
import type { PendingItem } from "../hooks/useGuard";
import { PENDING_STATUS } from "../lib/abi";
import { categoryName, labelOf } from "../lib/chain";
import { mon } from "../lib/format";

type Props = {
  pendings: PendingItem[];
  canAct: boolean;
  busyId: bigint | null;
  onDecide: (id: bigint, approve: boolean) => void;
};

export function PendingList({ pendings, canAct, busyId, onDecide }: Props) {
  const open = pendings.filter((p) => p.status === 1);
  const closed = pendings.filter((p) => p.status !== 1).slice(-3).reverse();

  return (
    <section className="card">
      <h2 className="card-title">
        <span className="icon">⏳</span> Onay bekleyenler {open.length > 0 && <span className="pill warn">{open.length}</span>}</h2>
      {open.length === 0 && <p className="muted">Bekleyen ödeme yok.</p>}
      <ul className="list">
        {open.map((p) => (
          <li key={String(p.id)} className="pending">
            <div>
              <strong>#{String(p.id)} {labelOf(p.provider)}</strong>
              <div className="muted">
                {mon(p.amount)} · {categoryName(p.category)}
              </div>
            </div>
            <div className="actions">
              <button disabled={!canAct || busyId !== null} onClick={() => onDecide(p.id, true)}>
                {busyId === p.id ? "…" : "Onayla"}
              </button>
              <button className="ghost" disabled={!canAct || busyId !== null} onClick={() => onDecide(p.id, false)}>
                Reddet
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!canAct && open.length > 0 && <p className="muted">Onaylamak için owner cüzdanını bağla.</p>}
      {closed.length > 0 && (
        <ul className="list muted">
          {closed.map((p) => (
            <li key={String(p.id)}>
              <span>#{String(p.id)} {labelOf(p.provider)}</span>
              <span>{PENDING_STATUS[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
