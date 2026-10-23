// Sabit arka plan katmanları (arkadan öne): gradyan + ızgara, yıldızlar, Monad amblemleri, Ankara silüeti.
// Parallax: fare hareket edince her katman farklı miktarda kayar (uzak = az, yakın = çok).
// Değerleri React state'e değil CSS değişkenine yazıyoruz: her fare hareketinde yeniden render olmasın.
import { useEffect, useRef } from "react";
import { MonadLogo } from "./MonadLogo";
import { Skyline } from "./Skyline";

const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1; // sabit sözde-rastgele
  return {
    left: `${r(1) * 100}%`,
    top: `${r(2) * 70}%`,
    size: 1 + r(3) * 2.2,
    delay: `${r(4) * 6}s`,
    duration: `${4 + r(5) * 6}s`,
  };
});

export function Backdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return; // saniyede en fazla ekran tazeleme hızı kadar güncelle
      frame = requestAnimationFrame(() => {
        frame = 0;
        const x = e.clientX / window.innerWidth - 0.5; // -0.5 … 0.5
        const y = e.clientY / window.innerHeight - 0.5;
        ref.current?.style.setProperty("--px", x.toFixed(3));
        ref.current?.style.setProperty("--py", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="backdrop" ref={ref} aria-hidden="true">
      <div className="backdrop-grid" />
      <div className="layer layer-stars">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="star"
            style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.duration }}
          />
        ))}
      </div>
      <div className="layer layer-logos">
        <MonadLogo size={760} className="bg-logo bg-logo-main" />
        <MonadLogo size={140} className="bg-logo bg-logo-a" />
        <MonadLogo size={90} className="bg-logo bg-logo-b" />
        <MonadLogo size={60} className="bg-logo bg-logo-c" />
      </div>
      <div className="layer layer-city">
        <Skyline />
      </div>
    </div>
  );
}
