// Ekranın alt yarısını kaplayan Ankara silüeti: Atakule, Anıtkabir ve aradaki şehir.
// Mor-lacivert, düşük opaklık: önde maskot net kalsın diye sadece atmosfer. Saf SVG, dış dosya yok.

// Şehir binaları: her yenilemede aynı görünsün diye sabit tohumlu basit rastgele sayı üreteci
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const H = 600; // viewBox yüksekliği
const rand = seeded(42);
const BUILDINGS = Array.from({ length: 72 }, (_, i) => {
  const w = 16 + rand() * 30;
  const h = 30 + rand() * 120;
  return { x: i * 23 - 12 + rand() * 8, w, h };
});
const WINDOWS = BUILDINGS.flatMap((b, i) =>
  Array.from({ length: Math.floor(b.h / 24) }, (_, j) => ({
    key: `${i}-${j}`,
    x: b.x + 4 + rand() * (b.w - 8),
    y: H - b.h + 10 + j * 22,
    on: rand() > 0.5,
  })),
);

function Atakule() {
  // 120 x 400 birim
  return (
    <g>
      <rect x="58.5" y="0" width="3" height="46" fill="#4a3f9c" />
      <path d="M40 78 A20 24 0 0 1 80 78 Z" fill="#3a3190" />
      <rect x="28" y="76" width="64" height="10" rx="5" fill="#4b41a6" />
      <rect x="34" y="86" width="52" height="14" rx="4" fill="#241d66" />
      <rect x="36" y="91" width="48" height="3" rx="1.5" className="atakule-lights" />
      <path d="M36 100 H84 L69 120 H51 Z" fill="#3d3494" />
      <rect x="51" y="120" width="18" height="230" fill="url(#shaft)" />
      <ellipse cx="60" cy="352" rx="44" ry="9" fill="#231c62" />
      <rect x="8" y="352" width="104" height="48" rx="4" fill="#1a1550" />
    </g>
  );
}

function Anitkabir() {
  // 406 x 162 birim: düz çatı, sütun sırası, kaide ve merdivenler; sütun aralarından ışık sızar
  const columns = Array.from({ length: 12 }, (_, i) => 104 + i * 17);
  return (
    <g>
      <rect x="96" y="42" width="214" height="22" fill="#2a2272" />
      <rect x="92" y="38" width="222" height="6" fill="#3a3190" />
      <rect x="100" y="64" width="206" height="44" className="anitkabir-glow" />
      {columns.map((x) => (
        <rect key={x} x={x} y="64" width="9" height="44" fill="#241d66" />
      ))}
      <rect x="86" y="108" width="234" height="14" fill="#2a2272" />
      <rect x="0" y="122" width="406" height="40" fill="#1d1758" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={150 + i * 10} y={122 + i * 9} width={106 - i * 20} height="9" fill="#241d66" />
      ))}
      <rect x="0" y="112" width="86" height="10" fill="#241d66" />
      <rect x="320" y="112" width="86" height="10" fill="#241d66" />
    </g>
  );
}

export function Skyline() {
  return (
    <svg className="skyline" viewBox={`0 0 1600 ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="city" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#221a60" />
          <stop offset="1" stopColor="#0b0a2a" />
        </linearGradient>
        <linearGradient id="shaft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2f2785" />
          <stop offset="0.5" stopColor="#6a5fd0" />
          <stop offset="1" stopColor="#2f2785" />
        </linearGradient>
        <radialGradient id="horizon" cx="0.5" cy="1" r="0.75">
          <stop offset="0" stopColor="#7b5cff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#7b5cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1600" height={H} fill="url(#horizon)" />
      {/* Atakule maskotla sol kapsüller arasındaki boşlukta, Anıtkabir sağ altta (maskotun arkasında kalmasınlar) */}
      <g transform={`translate(430 ${H - 520}) scale(1.3)`}>
        <Atakule />
      </g>
      <g transform={`translate(860 ${H - 200}) scale(1.24)`}>
        <Anitkabir />
      </g>
      {BUILDINGS.map((b, i) => (
        <rect key={i} x={b.x} y={H - b.h} width={b.w} height={b.h} fill="url(#city)" />
      ))}
      {WINDOWS.filter((w) => w.on).map((w) => (
        <rect key={w.key} x={w.x} y={w.y} width="2.5" height="2.5" fill="#ffd98a" opacity="0.55" />
      ))}
    </svg>
  );
}
