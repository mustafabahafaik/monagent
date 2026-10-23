// Kapsül kartlara "tutunan" küçük maskot sahneleri. Her biri public/mascot.png'yi küçük boyutta kullanır;
// efektler düz metin karakterleri ve CSS şekilleri. Animasyonlar sadece transform/opacity (index.css → Mini sahneler).
// Tek seferlik tepkiler (zıplama, fışkırma, "tık") için `key` değişir → element yeniden takılır → animasyon baştan oynar.
import { useEffect, useState, type CSSProperties } from "react";

export type Pulse = { kinds: string[]; n: number };

function MiniMascot({ className = "" }: { className?: string }) {
  return (
    <span className={`mini-mascot ${className}`}>
      <img src="/mascot.png" alt="" draggable={false} />
    </span>
  );
}

/** 1) Kararlar: kenara asılı, etrafında "?" süzülür; karar gelince ✓ ya da ✕ fışkırır. */
export function DecisionScene({ burst }: { burst: { tone: "ok" | "bad"; n: number } | null }) {
  const [active, setActive] = useState<typeof burst>(null);
  useEffect(() => {
    if (!burst) return;
    setActive(burst);
    const t = setTimeout(() => setActive(null), 1500);
    return () => clearTimeout(t);
  }, [burst]);

  return (
    <div className="mini mini-decision" aria-hidden="true">
      <span className="mini-hands" />
      <MiniMascot className="hang" />
      {active ? (
        <span key={active.n} className={`mini-fx burst ${active.tone}`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ "--i": i } as CSSProperties}>
              {active.tone === "ok" ? "✓" : "✕"}
            </i>
          ))}
        </span>
      ) : (
        <span className="mini-fx questions">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ "--i": i } as CSSProperties}>
              ?
            </i>
          ))}
        </span>
      )}
    </div>
  );
}

/** 2) x402: üst kenarda oturur, önünden mor coin'ler kayar; yeni 402 isteğinde zıplar. */
export function FlowScene({ hop }: { hop: number }) {
  return (
    <div className="mini mini-flow" aria-hidden="true">
      <span className="mini-fx coins">
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </span>
      <span key={hop} className={hop ? "mini-act act-catch" : "mini-act"}>
        <MiniMascot className="sit" />
      </span>
    </div>
  );
}

/** 3) Kurallar: kilidin arkasından bakar, ara sıra saklanır; ret gelince kilit kırmızı parlar ve sallanır. */
export function RulesScene({ alarm }: { alarm: number }) {
  return (
    <div className="mini mini-rules" aria-hidden="true">
      <MiniMascot className="peek" />
      <span key={alarm} className={alarm ? "mini-lock alarm" : "mini-lock"}>
        <span className="mini-lock-glow" />
      </span>
    </div>
  );
}

/** 4) Harcama: alt kenardaki çubukta harcanan oran kadar ilerler; %80'i geçince terler ve kızarır. */
export function SpendScene({ ratio }: { ratio: number }) {
  const p = Math.max(0, Math.min(1, ratio));
  const hot = p >= 0.8;
  return (
    <div className={hot ? "mini mini-spend hot" : "mini mini-spend"} style={{ "--p": p } as CSSProperties} aria-hidden="true">
      <span className="mini-track">
        <span className="mini-track-fill" />
      </span>
      <span className="mini-walker">
        <span className="mini-sweat-wrap">
          {/* Kızarma katmanı maskotla aynı kutuda: yürüme sallantısında birlikte hareket etsinler */}
          <span className="walk-body">
            <MiniMascot />
            <span className="mini-heat" />
          </span>
          <span className="mini-fx sweat" />
        </span>
      </span>
    </div>
  );
}

/** 5) İşlem akışı: alt kenarda blokları yukarı, zincire iter; yeni işlemde bir blok "tık" diye oturur. */
export function ChainScene({ snap }: { snap: number }) {
  return (
    <div className="mini mini-chain" aria-hidden="true">
      <span className="mini-fx blocks">
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </span>
      {snap > 0 && <span key={snap} className="mini-fx snap-block" />}
      <MiniMascot className="push" />
    </div>
  );
}

/** 6) Onay bekleyenler: kenarda oturup sallanır, yanında kum saati; bekleyen varsa "!", onayda sevinç zıplaması. */
export function PendingScene({ waiting, joy }: { waiting: boolean; joy: number }) {
  return (
    <div className="mini mini-pending" aria-hidden="true">
      <span className="mini-fx hourglass">
        <span />
      </span>
      {waiting && <span className="mini-fx alert">!</span>}
      <span key={joy} className={joy ? "mini-act act-joy" : "mini-act"}>
        <MiniMascot className="swing" />
      </span>
    </div>
  );
}
