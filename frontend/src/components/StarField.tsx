// Arka plandaki yıldız gökyüzü: tek bir <canvas>, requestAnimationFrame ile çizilir.
// - 120–180 yıldız (mobilde yarısı), 0.5–2 px, beyaz ve açık mor; her biri kendi hızında parlayıp söner
// - Rastgele 4–9 sn'de bir kayan yıldız (aynı anda en fazla 2), ~1 sn'de solan izle kaybolur
// - Sekme görünmezken döngü durur; ekran boyutu değişince canvas yeniden boyutlanır
// - prefers-reduced-motion: yıldızlar bir kez çizilir ve sabit kalır, kayan yıldız yok
import { useEffect, useRef } from "react";

type Star = { x: number; y: number; r: number; color: string; base: number; speed: number; phase: number };
type Meteor = { x: number; y: number; vx: number; vy: number; age: number };

const COLORS = ["#ffffff", "#ffffff", "#e6e0ff", "#c9bdff", "#b3a6ff"]; // beyaz ağırlıklı, açık mor karışık
const METEOR_LIFE = 1; // sn
const MAX_METEORS = 2;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function makeStars(mobile: boolean): Star[] {
  const count = Math.round(rand(120, 180) / (mobile ? 2 : 1));
  return Array.from({ length: count }, () => ({
    x: Math.random(), // 0–1 arası: ekran boyutu değişince yeniden üretmeye gerek kalmaz
    y: Math.random(),
    r: rand(0.25, 1), // yarıçap → çap 0.5–2 px
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    base: rand(0.45, 1),
    speed: rand(0.4, 1.6), // parlama hızı (rad/sn)
    phase: rand(0, Math.PI * 2),
  }));
}

export function StarField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = () => window.innerWidth < 768;

    let mobile = isMobile();
    let stars = makeStars(mobile);
    let meteors: Meteor[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let nextMeteor = rand(4, 9);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // retina'da keskin, ama 2x'ten fazlası boşa
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (isMobile() !== mobile) {
        mobile = isMobile();
        stars = makeStars(mobile);
      }
      // Canvas boyutu değişince içeriği silinir: döngüyü beklemeden hemen bir kare çiz
      // (sekme arka planda açıldıysa ya da hareket azaltma açıksa gökyüzü boş kalmasın)
      draw(performance.now() / 1000);
    }

    function spawnMeteor() {
      const dir = Math.random() < 0.5 ? 1 : -1; // sağa ya da sola, hep aşağı doğru çapraz
      const angle = rand(0.45, 0.75); // ~25–43° yataydan aşağı
      const speed = rand(Math.max(width, 600) * 0.5, Math.max(width, 600) * 0.8); // px/sn
      meteors.push({
        x: dir > 0 ? rand(0.05, 0.6) * width : rand(0.4, 0.95) * width,
        y: rand(0, 0.25) * height,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed,
        age: 0,
      });
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const twinkle = reduced ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.globalAlpha = s.base * twinkle;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const m of meteors) {
        const life = 1 - m.age / METEOR_LIFE; // 1 → 0: hem baş hem iz solar
        const tail = 0.12; // izin uzunluğu (sn cinsinden geçmiş konum)
        const tx = m.x - m.vx * tail;
        const ty = m.y - m.vy * tail;
        const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
        grad.addColorStop(0, `rgba(235, 230, 255, ${0.95 * life})`);
        grad.addColorStop(0.3, `rgba(179, 166, 255, ${0.5 * life})`);
        grad.addColorStop(1, "rgba(131, 110, 249, 0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${life})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function tick(now: number) {
      const t = now / 1000;
      const dt = last ? Math.min(t - last, 0.1) : 0; // sekmeye dönünce dev bir sıçrama olmasın
      last = t;

      nextMeteor -= dt;
      if (nextMeteor <= 0) {
        if (meteors.length < MAX_METEORS) spawnMeteor();
        nextMeteor = rand(4, 9);
      }
      for (const m of meteors) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.age += dt;
      }
      meteors = meteors.filter((m) => m.age < METEOR_LIFE);

      draw(t);
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (reduced || frame || document.hidden) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    }
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
