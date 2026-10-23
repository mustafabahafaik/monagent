import { useState } from "react";

// public/mascot.png henüz yoksa görsel yerine boş bir çerçeve gösterilir
export function Mascot() {
  const [missing, setMissing] = useState(false);
  return (
    <div className="mascot">
      {missing ? (
        <div className="mascot-missing">public/mascot.png</div>
      ) : (
        <img src="/mascot.png" alt="AgentGuard ajanı" onError={() => setMissing(true)} />
      )}
    </div>
  );
}
