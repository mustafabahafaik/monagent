// Karar sayaçları: Settled / Pending / Rejected ve başarı oranı halkası.
import type { Activity } from "../hooks/useActivity";

type Props = { items: Activity[]; openPending: number };

export function Stats({ items, openPending }: Props) {
  const settled = items.filter((a) => a.kind === "Settled").length;
  const rejected = items.filter((a) => a.kind === "Rejected" || a.kind === "PendingRejected").length;
  const total = settled + rejected;
  const rate = total === 0 ? 0 : Math.round((settled / total) * 100);

  // Halka: çevre = 2πr; dolu kısmı stroke-dasharray ile çiziyoruz
  const r = 26;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="stats-grid">
      <div className="stat">
        <span className="stat-label">Settled</span>
        <strong className="ok-text">{settled}</strong>
      </div>
      <div className="stat">
        <span className="stat-label">Pending</span>
        <strong className="warn-text">{openPending}</strong>
      </div>
      <div className="stat">
        <span className="stat-label">Rejected</span>
        <strong className="bad-text">{rejected}</strong>
      </div>
      <div className="stat rate">
        <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
          <circle cx="32" cy="32" r={r} className="rate-track" />
          <circle
            cx="32"
            cy="32"
            r={r}
            className="rate-fill"
            strokeDasharray={`${(circumference * rate) / 100} ${circumference}`}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div>
          <span className="stat-label">Başarı</span>
          <strong>{total === 0 ? "—" : `%${rate}`}</strong>
        </div>
      </div>
    </div>
  );
}
