// Ortadaki sahne: maskot, etrafında dönen halkalar ve altında ışıklı platform (referans görseldeki robot gibi).
import { useState } from "react";
import { AnkaraScene } from "./Skyline";

export function Mascot({ live, lastDecision }: { live: boolean; lastDecision?: string }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className="hero">
      <div className="hero-top">
      <AnkaraScene />
      <div className="hero-stage">
        <svg className="hero-rings" viewBox="0 0 400 400" aria-hidden="true">
          <circle cx="200" cy="200" r="188" className="ring ring-dashed" />
          <circle cx="200" cy="200" r="165" className="ring ring-thin" />
          <circle cx="200" cy="12" r="5" className="ring-dot" />
        </svg>
        {missing ? (
          <div className="mascot-missing">public/mascot.png</div>
        ) : (
          <img className="mascot" src="/mascot.png" alt="AgentGuard maskotu" onError={() => setMissing(true)} />
        )}
        <div className="hero-platform" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      </div>
      <div className="hero-caption">
        <h1>AgentGuard</h1>
        <p>Yapay zekâ ajanlarının harcama yetkisini zincirde denetleyen güvenlik katmanı</p>
        <div className="hero-status">
          <span className={live ? "live-dot" : "live-dot off"} />
          {live ? "Monad Testnet canlı izleniyor" : "Bağlanıyor…"}
          {lastDecision && <span className="muted"> · son karar: {lastDecision}</span>}
        </div>
      </div>
    </div>
  );
}
