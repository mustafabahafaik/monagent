// Maskotun etrafında yüzen kapsül. Kapalıyken: ikon + başlık + tek özet değer.
// Tıklanınca gövde açılır; yükseklik animasyonu grid-template-rows 0fr → 1fr hilesiyle yapılır
// (height: auto'ya CSS ile geçiş yapılamadığı için).
import type { CSSProperties, ReactNode } from "react";

export type Slot = {
  side: "left" | "right";
  top: string; // sahnedeki dikey konum (%)
  inset: string; // kenardan uzaklık (%): yay etkisi için ortadakiler daha dışarıda
  width: number; // kapalı genişlik (px): hepsi aynı olmasın
  tilt: number; // hafif eğim (derece)
  delay: number; // yüzme animasyonu gecikmesi (sn): hepsi aynı anda kıpırdamasın
};

type Props = {
  id: string;
  icon: string;
  title: string;
  summary: ReactNode;
  tone?: "warn";
  slot: Slot;
  open: boolean;
  onToggle: (id: string) => void;
  scene?: ReactNode; // karta tutunan mini maskot sahnesi (MiniScenes.tsx)
  children: ReactNode;
};

export function OrbitCard({ id, icon, title, summary, tone, slot, open, onToggle, scene, children }: Props) {
  const style = {
    "--top": slot.top,
    "--inset": slot.inset,
    "--w": `${slot.width}px`,
    "--tilt": `${slot.tilt}deg`,
    "--delay": `${slot.delay}s`,
    "--dir": slot.side === "left" ? -1 : 1,
  } as CSSProperties;

  return (
    <section
      className={`capsule capsule-${slot.side}${open ? " open" : ""}${tone ? ` capsule-${tone}` : ""}`}
      style={style}
      data-capsule={id}
    >
      {scene}
      <button className="capsule-head" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="icon">{icon}</span>
        <span className="capsule-text">
          <span className="capsule-title">{title}</span>
          <span className="capsule-summary">{summary}</span>
        </span>
        <span className="capsule-chevron" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="capsule-body">
        <div className="capsule-inner">{children}</div>
      </div>
    </section>
  );
}
