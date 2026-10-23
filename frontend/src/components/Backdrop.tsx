// Sabit arka plan: mor-mavi gradyan, ızgara, dönen Monad amblemleri ve Ankara silüeti.
import { MonadLogo } from "./MonadLogo";
import { Skyline } from "./Skyline";

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-grid" />
      <MonadLogo size={720} className="bg-logo bg-logo-main" />
      <MonadLogo size={140} className="bg-logo bg-logo-a" />
      <MonadLogo size={90} className="bg-logo bg-logo-b" />
      <MonadLogo size={60} className="bg-logo bg-logo-c" />
      <Skyline />
    </div>
  );
}
