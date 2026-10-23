// Ankara: arka plandaki şehir silüeti (Skyline) ve maskotun iki yanındaki Atakule + Anıtkabir (AnkaraScene).
// Saf SVG, dış dosya yok.

// Şehir binaları: her yenilemede aynı görünsün diye sabit tohumlu basit rastgele sayı üreteci
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const rand = seeded(42);
const BUILDINGS = Array.from({ length: 70 }, (_, i) => {
  const w = 14 + rand() * 26;
  const h = 18 + rand() * 70;
  return { x: i * 23 - 10 + rand() * 8, w, h };
});
const WINDOWS = BUILDINGS.flatMap((b, i) =>
  Array.from({ length: Math.floor(b.h / 22) }, (_, j) => ({
    key: `${i}-${j}`,
    x: b.x + 4 + rand() * (b.w - 8),
    y: 300 - b.h + 8 + j * 20,
    on: rand() > 0.45,
  })),
);

export function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="city" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f1857" />
          <stop offset="1" stopColor="#0a0a24" />
        </linearGradient>
        <radialGradient id="horizon" cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#7b5cff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#7b5cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1600" height="300" fill="url(#horizon)" />
      {BUILDINGS.map((b, i) => (
        <rect key={i} x={b.x} y={300 - b.h} width={b.w} height={b.h} fill="url(#city)" />
      ))}
      {WINDOWS.filter((w) => w.on).map((w) => (
        <rect key={w.key} x={w.x} y={w.y} width="2" height="2" fill="#ffd98a" opacity="0.7" />
      ))}
    </svg>
  );
}

function Atakule() {
  // 120 x 400 birim. Gövde ve çanak fotoğraftaki gibi beyaz ışıkla aydınlatılmış.
  return (
    <g>
      <rect x="58.5" y="0" width="3" height="46" fill="url(#lit)" />
      <path d="M40 78 A20 24 0 0 1 80 78 Z" fill="url(#dome)" />
      <rect x="28" y="76" width="64" height="10" rx="5" fill="url(#lit)" />
      <rect x="34" y="86" width="52" height="14" rx="4" fill="#1b1550" />
      <rect x="36" y="91" width="48" height="3" rx="1.5" className="atakule-lights" />
      <path d="M36 100 H84 L69 120 H51 Z" fill="url(#lit)" />
      <rect x="51" y="120" width="18" height="230" fill="url(#shaft)" />
      <rect x="58" y="125" width="4" height="220" fill="#ffffff" opacity="0.35" />
      <ellipse cx="60" cy="352" rx="44" ry="9" fill="#2a2370" />
      <rect x="8" y="352" width="104" height="48" rx="4" fill="#191446" />
    </g>
  );
}

function Anitkabir() {
  // 406 x 162 birim. Şeref Holü: düz çatı, önde sütun sırası, kaide ve merdivenler; sütun aralarından ışık sızar.
  const columns = Array.from({ length: 12 }, (_, i) => 104 + i * 17);
  return (
    <g>
      <rect x="96" y="42" width="214" height="22" fill="#1d1752" />
      <rect x="92" y="38" width="222" height="6" fill="#2b2370" />
      <rect x="100" y="64" width="206" height="44" className="anitkabir-glow" />
      {columns.map((x) => (
        <rect key={x} x={x} y="64" width="9" height="44" fill="#1a1449" />
      ))}
      <rect x="86" y="108" width="234" height="14" fill="#211a5c" />
      <rect x="0" y="122" width="406" height="40" fill="#15113d" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={150 + i * 10} y={122 + i * 9} width={106 - i * 20} height="9" fill="#1c1650" />
      ))}
      <rect x="0" y="112" width="86" height="10" fill="#1a1449" />
      <rect x="320" y="112" width="86" height="10" fill="#1a1449" />
    </g>
  );
}

/** Maskotun arkasındaki ufuk: solda Atakule, sağda Anıtkabir. */
export function AnkaraScene() {
  return (
    <svg className="ankara-scene" viewBox="0 0 480 360" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="lit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f86d9" />
          <stop offset="0.5" stopColor="#e8e6ff" />
          <stop offset="1" stopColor="#8f86d9" />
        </linearGradient>
        <linearGradient id="shaft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5d54b5" />
          <stop offset="0.5" stopColor="#c9c3ff" />
          <stop offset="1" stopColor="#5d54b5" />
        </linearGradient>
        <radialGradient id="dome" cx="0.4" cy="0.3">
          <stop offset="0" stopColor="#8fa8ff" />
          <stop offset="1" stopColor="#3b3392" />
        </radialGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7b5cff" stopOpacity="0" />
          <stop offset="1" stopColor="#7b5cff" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <rect x="0" y="250" width="480" height="110" fill="url(#ground)" />
      <g transform="translate(6 32) scale(0.82)">
        <Atakule />
      </g>
      <g transform="translate(272 279) scale(0.5)">
        <Anitkabir />
      </g>
    </svg>
  );
}
