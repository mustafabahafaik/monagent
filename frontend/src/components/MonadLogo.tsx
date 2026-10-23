// Monad amblemi: 45° döndürülmüş, köşeleri yuvarlak bir kare halka.
// İki yuvarlak kare path'i + fill-rule="evenodd" → içteki kare delik olur.
function roundedSquare(c: number, half: number, r: number) {
  const a = c - half;
  const b = c + half;
  return `M${a + r} ${a} H${b - r} Q${b} ${a} ${b} ${a + r} V${b - r} Q${b} ${b} ${b - r} ${b} H${a + r} Q${a} ${b} ${a} ${b - r} V${a + r} Q${a} ${a} ${a + r} ${a} Z`;
}

const PATH = `${roundedSquare(50, 33, 15)} ${roundedSquare(50, 14, 5)}`;

export function MonadLogo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d={PATH} transform="rotate(45 50 50)" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
