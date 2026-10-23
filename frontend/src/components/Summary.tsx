// Harcama özeti: toplamlar sözleşmeden, servis kırılımı son event'lerden.
import type { Activity } from "../hooks/useActivity";
import type { GuardState } from "../hooks/useGuard";
import { labelOf } from "../lib/chain";
import { mon } from "../lib/format";

export function Summary({ state, activity }: { state: GuardState; activity: Activity[] }) {
  const used = state.totalBudget > 0n ? Number((state.spent * 1000n) / state.totalBudget) / 10 : 0;

  const byProvider = new Map<string, bigint>();
  for (const a of activity) {
    if (a.kind !== "Settled" || !a.provider || a.amount === undefined) continue;
    byProvider.set(a.provider, (byProvider.get(a.provider) ?? 0n) + a.amount);
  }
  const rejected = activity.filter((a) => a.kind === "Rejected").length;

  return (
    <section className="card">
      <h2>Harcama özeti</h2>
      <div className="big">
        {mon(state.spent)} <span className="muted">/ {mon(state.totalBudget)}</span>
      </div>
      <div className="bar">
        <div style={{ width: `${Math.min(used, 100)}%` }} />
      </div>
      <dl className="stats">
        <dt>Kalan bütçe</dt>
        <dd>{mon(state.remaining)}</dd>
        <dt>Kasa bakiyesi</dt>
        <dd>{mon(state.balance)}</dd>
        <dt>Reddedilen (son)</dt>
        <dd>{rejected}</dd>
      </dl>
      {byProvider.size > 0 && (
        <>
          <h3>Servis bazında (son aktivite)</h3>
          <ul className="list">
            {[...byProvider].map(([provider, total]) => (
              <li key={provider}>
                <span>{labelOf(provider)}</span>
                <span>{mon(total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
