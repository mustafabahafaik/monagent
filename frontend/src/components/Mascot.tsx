// Ortadaki sahne. Sabit katman: halkalar + platform. Hareketli katman: sadece maskot görseli.
// Maskot katmanları iç içe, böylece animasyonlar birbirini ezmez:
//   .mascot-bob   → sürekli süzülme + nefes (idle)
//   .mascot-sway  → onay beklerken yerinde sallanma
//   .mascot-act   → tek seferlik hareket: takla / zıplama / kafa sallama (CSS keyframes)
// Altındaki gölge (.mascot-shadow) aynı zamanlamayla küçülür/büyür: maskot yükselince küçülür.
import { useCallback, useEffect, useRef, useState } from "react";

export type Reaction = { kind: "approve" | "reject"; n: number };
type Act = "flip" | "hop" | "shake" | null;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Mascot({ reaction, pending }: { reaction: Reaction | null; pending: boolean }) {
  const [act, setAct] = useState<Act>(null);
  const [flash, setFlash] = useState<{ tone: "ok" | "bad"; n: number } | null>(null);
  const [missing, setMissing] = useState(false);
  const busy = useRef(false);

  // Aynı hareketi üst üste tetikleyebilmek için önce sınıfı kaldır, bir kare sonra geri ekle
  const play = useCallback((next: Exclude<Act, null>) => {
    busy.current = true;
    setAct(null);
    requestAnimationFrame(() => setAct(next));
  }, []);

  // Rastgele 6–12 sn'de bir takla (hareket azaltma açıksa yok)
  useEffect(() => {
    if (reducedMotion()) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!busy.current) play("flip");
        schedule();
      }, 6000 + Math.random() * 6000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [play]);

  // Ajan durumuna tepki: onayda zıpla + yeşil halka, redde kafa salla + kırmızı halka
  useEffect(() => {
    if (!reaction) return;
    setFlash({ tone: reaction.kind === "approve" ? "ok" : "bad", n: reaction.n });
    if (!reducedMotion()) play(reaction.kind === "approve" ? "hop" : "shake");
  }, [reaction, play]);

  return (
    <div className="mascot-wrap">
      {/* Sabit katman: maskotla birlikte hareket etmez */}
      <svg className="hero-rings" viewBox="0 0 400 400" aria-hidden="true">
        <circle cx="200" cy="200" r="188" className="ring ring-dashed" />
        <circle cx="200" cy="200" r="165" className="ring ring-thin" />
        <circle cx="200" cy="12" r="5" className="ring-dot" />
      </svg>
      <div className="hero-platform" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={act ? `mascot-shadow sh-${act}` : "mascot-shadow"} aria-hidden="true" />

      {/* Hareketli katman: sadece maskot; dışarı taşabilir (overflow: visible) */}
      <div className="mascot-bob">
        <div className={pending ? "mascot-sway on" : "mascot-sway"}>
          <button
            className={act ? `mascot-act act-${act}` : "mascot-act"}
            onClick={() => !reducedMotion() && play("flip")}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return; // içteki animasyonlar da buraya kabarcıklanır
              setAct(null);
              busy.current = false;
            }}
            aria-label="Maskot: tıklayınca takla atar"
          >
            {missing ? (
              <span className="mascot mascot-missing">public/mascot.png</span>
            ) : (
              <img className="mascot" src="/mascot.png" alt="MONAGENT maskotu" onError={() => setMissing(true)} draggable={false} />
            )}
          </button>
          {flash && <span key={flash.n} className={`mascot-flash ${flash.tone}`} aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}
