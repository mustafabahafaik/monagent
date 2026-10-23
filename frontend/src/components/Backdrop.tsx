// Sabit arka plan katmanları (arkadan öne): gradyan + ızgara, yıldızlar, Monad amblemleri, Ankara silüeti.
// Parallax: fare hareket edince her katman farklı miktarda kayar (uzak = az, yakın = çok).
// Değerleri React state'e değil CSS değişkenine yazıyoruz: her fare hareketinde yeniden render olmasın.
import { useEffect, useRef } from "react";
import { MonadLogo } from "./MonadLogo";
import { Skyline } from "./Skyline";
import { StarField } from "./StarField";

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
      {/* Yıldızlar en arkada: DOM sırası gereği Monad amblemleri ve Ankara silüeti önlerinde kalır */}
      <div className="layer layer-stars">
        <StarField />
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
