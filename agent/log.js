// Renkli konsol çıktısı. Her satırın başında kimin konuştuğu yazar: [AJAN], [SecureScan]...
import pc from "picocolors";

const time = () => pc.dim(new Date().toLocaleTimeString("tr-TR"));

export function logger(name, color = pc.cyan) {
  const tag = color(pc.bold(`[${name}]`));
  const line = (icon, text) => console.log(`${time()} ${tag} ${icon} ${text}`);
  return {
    step: (t) => line(pc.blue("→"), t),
    info: (t) => line(pc.dim("·"), pc.dim(t)),
    pay: (t) => line(pc.yellow("$"), pc.yellow(t)),
    wait: (t) => line(pc.magenta("…"), pc.magenta(t)),
    ok: (t) => line(pc.green("✔"), pc.green(t)),
    fail: (t) => line(pc.red("✖"), pc.red(t)),
  };
}

export { pc };
