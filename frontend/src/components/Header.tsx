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
        <strong>AgentGuard</strong>
        <a href={addressUrl(GUARD)} target="_blank" rel="noreferrer" className="muted">
          {short(GUARD)}
        </a>
        <span className="badge">Monad Testnet</span>
      </div>
      {account ? (
        <span className={isOwner ? "badge ok" : "badge warn"}>
          {short(account)} · {isOwner ? "owner" : "owner değil"}
        </span>
      ) : (
        <button onClick={onConnect}>Cüzdan bağla</button>
      )}
    </header>
  );
}
