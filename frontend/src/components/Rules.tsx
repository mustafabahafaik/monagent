// Owner'ın koyduğu kurallar: limitler, allowlist, kapsam. Hepsi sözleşmeden okunur.
import type { GuardState } from "../hooks/useGuard";
import { addressUrl, labelOf } from "../lib/chain";
import { mon } from "../lib/format";

export function Rules({ state }: { state: GuardState }) {
  return (
    <div className="detail-body">
      <dl className="stats">
        <dt>Tek işlem limiti</dt>
        <dd>{mon(state.perTxLimit)}</dd>
        <dt>Toplam bütçe</dt>
        <dd>{mon(state.totalBudget)}</dd>
      </dl>

      <h3>İzinli servisler</h3>
      <ul className="list">
        {state.providers.map((p) => (
          <li key={p.address}>
            <a href={addressUrl(p.address)} target="_blank" rel="noreferrer">
              {labelOf(p.address)}
            </a>
            <span className={p.allowed ? "pill ok" : "pill"}>{p.allowed ? "izinli" : "izinsiz"}</span>
          </li>
        ))}
      </ul>

      <h3>Kapsam</h3>
      <div className="chips">
        {state.categories.map((c) => (
          <span key={c.name} className={c.allowed ? "chip on" : "chip"}>
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}
