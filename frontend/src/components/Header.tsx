import type { Address } from "viem";
import { GUARD, addressUrl, short } from "../lib/chain";

type Props = {
  account: Address | null;
  isOwner: boolean;
  onConnect: () => void;
};

export function Header({ account, isOwner, onConnect }: Props) {
  return (
    <header className="header">
      <div className="brand">
        {/* Maskot silüeti: mascot.png'nin şeffaflığı CSS mask olarak kullanılır, renk background'dan gelir */}
        <span className="brand-mascot" aria-hidden="true" />
        <strong>MONAGENT</strong>
      </div>
      <div className="header-right">
        <a className="pill" href={addressUrl(GUARD)} target="_blank" rel="noreferrer">
          <span className="live-dot" /> Monad Testnet · {short(GUARD)}
        </a>
        {account ? (
          <span className={isOwner ? "pill ok" : "pill warn"}>
            {short(account)} · {isOwner ? "owner" : "owner değil"}
          </span>
        ) : (
          <button onClick={onConnect}>Cüzdan bağla</button>
        )}
      </div>
    </header>
  );
}
