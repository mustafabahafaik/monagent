// Tek komutla demo: npm run demo (kök klasörden)
//   1) Sözleşme yoksa (veya --fresh) deploy eder; --fresh eski kasadaki MON'u owner'a geri çeker
//   2) Sahneyi hazırlar: TestRunner Pro allowlist dışında, bütçe/kasa/ajan gas'ı bir tura yeter
//   3) Servisleri ve paneli başlatır, paneli tarayıcıda açar
//   4) Ajanı çalıştırır: SecureScan → otomatik onay, TestRunner Pro → panelden kullanıcı onayı, GPU Burst → limit reddi
//   5) Ajan bitince servisler ve panel açık kalır (Ctrl+C ile kapanır)
// Seçenekler: --fresh (yeniden deploy), --auto-approve (prova için: TestRunner'ı owner key'iyle kendisi onaylar),
//             --no-open (tarayıcıyı açma). Görev metni: DEMO_TASK ortam değişkeni.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http, parseEther, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { guardAbi } from "./abi.js";
import { logger, pc } from "./log.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const FRESH = args.has("--fresh");
const AUTO_APPROVE = args.has("--auto-approve");
const OPEN = !args.has("--no-open");
const SERVICES_PORT = Number(process.env.SERVICES_PORT ?? 4020);
const PANEL_PORT = Number(process.env.PANEL_PORT ?? 5180);
const TASK = process.env.DEMO_TASK ?? "AgentGuard kasasını denetle ve testlerini koştur";

const ROUND_COST = parseEther("0.05"); // SecureScan 0.02 + TestRunner 0.03 (GPU Burst zaten reddedilir)
const ZERO = /^0x0{40}$/;
const log = logger("DEMO", pc.yellow);
const children = [];

// ---------------------------------------------------------------- yardımcılar

function readEnv(file) {
  if (!existsSync(file)) throw new Error(`${file} yok: önce .env.example'ı kopyalayıp doldur`);
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

/** agent/config.js'i metin olarak oku: import edersek Node önbelleğe alır, deploy sonrası yeni adresi göremeyiz. */
function readConfig() {
  const text = readFileSync(join(ROOT, "agent", "config.js"), "utf8");
  const get = (name) => text.match(new RegExp(`${name} = "?([^";]+)"?;`))?.[1];
  return { guard: get("GUARD_ADDRESS"), rpc: get("RPC_URL"), chainId: Number(get("CHAIN_ID")) };
}

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} çıkış kodu ${code}`))));
  });
}

/** Arka planda süreç başlat; çıktısının her satırına etiket ekle (filter: hangi satırlar gösterilsin). */
function background(name, cmd, cmdArgs, opts, filter = () => true) {
  const child = spawn(cmd, cmdArgs, { ...opts, env: { ...process.env, FORCE_COLOR: "1", ...opts.env } });
  children.push(child);
  const forward = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line.trim() && filter(line)) console.log(line);
  };
  child.stdout.on("data", forward);
  child.stderr.on("data", forward);
  child.on("exit", (code) => code && log.fail(`${name} kapandı (kod ${code})`));
  return child;
}

function waitForPort(port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ port, host: "localhost" }); // Vite Windows'ta ::1'e (IPv6) bağlanıyor, localhost ikisini de dener
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`port ${port} ${timeoutMs / 1000} sn'de açılmadı`));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "localhost" }); // Vite Windows'ta ::1'e (IPv6) bağlanıyor, localhost ikisini de dener
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function forgeBin() {
  const local = join(homedir(), ".foundry", "bin", process.platform === "win32" ? "forge.exe" : "forge");
  return existsSync(local) ? local : "forge"; // Git Bash'te PATH'te olmayabiliyor
}

function openBrowser(url) {
  const [cmd, cmdArgs] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).unref();
}

function shutdown(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => {
  console.log();
  log.info("kapatılıyor…");
  shutdown(0);
});

// ---------------------------------------------------------------- adımlar

async function deploy(ownerKey) {
  const before = readConfig();
  if (!ZERO.test(before.guard)) {
    // Eski kasada kalan MON boşa gitmesin: owner'a geri çek
    const client = clients(before, ownerKey);
    const balance = await client.public.getBalance({ address: before.guard });
    if (balance > 0n) {
      log.step(`eski kasadaki ${formatEther(balance)} MON owner'a geri çekiliyor`);
      await client.send("withdraw", [client.owner.address, balance]);
    }
  }
  log.step("AgentGuard deploy ediliyor (forge script)…");
  await run(forgeBin(), ["script", "script/Deploy.s.sol", "--rpc-url", "monad_testnet", "--broadcast", "--gas-estimate-multiplier", "200"], {
    cwd: join(ROOT, "contracts"),
  });
  const after = readConfig();
  if (ZERO.test(after.guard) || after.guard === before.guard) throw new Error("deploy sonrası config.js güncellenmedi");
  log.ok(`yeni AgentGuard: ${after.guard}`);
}

function clients(cfg, ownerKey) {
  const chain = {
    id: cfg.chainId,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpc] } },
  };
  const owner = privateKeyToAccount(ownerKey);
  const pub = createPublicClient({ chain, transport: http(), pollingInterval: 500 });
  const wallet = createWalletClient({ account: owner, chain, transport: http() });
  const read = (functionName, fnArgs = []) => pub.readContract({ address: cfg.guard, abi: guardAbi, functionName, args: fnArgs });
  const send = async (functionName, fnArgs) => {
    const hash = await wallet.writeContract({ address: cfg.guard, abi: guardAbi, functionName, args: fnArgs });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${functionName} başarısız: ${hash}`);
    return receipt;
  };
  // Monad reserve balance: 10 MON altındaki hesap, son 3 blokta işlem gönderdiyse MON transfer edemez
  // (işlem revert olur). Bu yüzden para gönderen her işlemden önce 4 blok bekliyoruz (~2 sn).
  const sendValue = async (to, value) => {
    const start = await pub.getBlockNumber();
    while ((await pub.getBlockNumber()) < start + 4n) await new Promise((r) => setTimeout(r, 400));
    const hash = await wallet.sendTransaction({ to, value });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`MON gönderimi başarısız (reserve balance?): ${hash}`);
  };
  return { public: pub, wallet, owner, read, send, sendValue };
}

/** Senaryonun her seferinde aynı oynanması için sözleşmeyi hazırla. */
async function prepareStage(cfg, ownerKey, agentEnv) {
  const c = clients(cfg, ownerKey);
  const testRunner = agentEnv.PROVIDER_TESTRUNNER;
  const agent = agentEnv.AGENT_ADDRESS;

  if (await c.read("allowedProvider", [testRunner])) {
    log.step("TestRunner Pro allowlist'ten çıkarılıyor (kullanıcı onayı sahnesi için)");
    await c.send("setProvider", [testRunner, false]);
  }

  const [perTx, budget, spent, balance] = await Promise.all([
    c.read("perTxLimit"),
    c.read("totalBudget"),
    c.read("spent"),
    c.public.getBalance({ address: cfg.guard }),
  ]);
  if (budget - spent < ROUND_COST) {
    const next = spent + parseEther("0.2");
    log.step(`bütçe bitmek üzere: totalBudget ${formatEther(budget)} → ${formatEther(next)} MON`);
    await c.send("setLimits", [perTx, next]);
  }
  if (balance < ROUND_COST) {
    log.step("kasaya 0.2 MON yatırılıyor (reserve balance için birkaç blok bekleyerek)");
    await c.sendValue(cfg.guard, parseEther("0.2"));
  }
  const agentGas = await c.public.getBalance({ address: agent });
  if (agentGas < parseEther("0.06")) {
    log.step("ajan cüzdanına gas için 0.2 MON gönderiliyor");
    await c.sendValue(agent, parseEther("0.2"));
  }

  const [s, b, k, g] = await Promise.all([
    c.read("spent"),
    c.read("totalBudget"),
    c.public.getBalance({ address: cfg.guard }),
    c.public.getBalance({ address: agent }),
  ]);
  log.ok(`sahne hazır · harcanan ${formatEther(s)}/${formatEther(b)} MON · kasa ${formatEther(k)} · ajan gas ${formatEther(g)}`);
  return c;
}

/** --auto-approve: owner yerine yeni Pending'i 4 sn sonra onayla (prova / ekran kaydı için). */
function autoApprover(c) {
  let stop = false;
  (async () => {
    let next = (await c.read("pendingCount")) + 1n;
    while (!stop) {
      await new Promise((r) => setTimeout(r, 1000));
      if ((await c.read("pendingCount")) >= next) {
        log.wait(`--auto-approve: #${next} 4 sn sonra owner olarak onaylanacak`);
        await new Promise((r) => setTimeout(r, 4000));
        const receipt = await c.send("approvePending", [next]);
        const ok = parseEventLogs({ abi: guardAbi, eventName: "PendingApproved", logs: receipt.logs }).length > 0;
        log.ok(`#${next} onaylandı${ok ? "" : " (event görülmedi!)"}`);
        next++;
      }
    }
  })().catch((err) => log.fail(`auto-approve: ${err.shortMessage ?? err.message}`));
  return () => {
    stop = true;
  };
}

// ---------------------------------------------------------------- ana akış

async function main() {
  const contractsEnv = readEnv(join(ROOT, "contracts", ".env"));
  const agentEnv = readEnv(join(ROOT, "agent", ".env"));
  const ownerKey = contractsEnv.PRIVATE_KEY;

  for (const port of [SERVICES_PORT, PANEL_PORT]) {
    if (await portInUse(port)) throw new Error(`port ${port} dolu: önceki demo hâlâ açık olabilir (Ctrl+C ile kapat)`);
  }

  if (FRESH || ZERO.test(readConfig().guard)) await deploy(ownerKey);
  const cfg = readConfig();
  log.info(`AgentGuard ${cfg.guard} · ${cfg.rpc}`);

  const c = await prepareStage(cfg, ownerKey, agentEnv);

  log.step("servisler ve panel başlatılıyor…");
  background("servisler", process.execPath, ["services.js"], { cwd: join(ROOT, "agent"), env: { SERVICES_PORT: String(SERVICES_PORT) } });
  // Vite'ı npm yerine doğrudan node ile başlatıyoruz: Windows'ta npm'in alt süreçleri kill ile kapanmıyor
  background(
    "panel",
    process.execPath,
    [join(ROOT, "frontend", "node_modules", "vite", "bin", "vite.js"), "--port", String(PANEL_PORT), "--strictPort"],
    { cwd: join(ROOT, "frontend") },
    (line) => /error|Error|failed/.test(line), // Vite'ın açılış afişini gösterme, sadece hatalar
  );
  await Promise.all([waitForPort(SERVICES_PORT), waitForPort(PANEL_PORT)]);
  const panelUrl = `http://localhost:${PANEL_PORT}`;
  log.ok(`panel hazır: ${pc.bold(panelUrl)}`);
  if (OPEN) openBrowser(panelUrl);

  console.log();
  log.step(pc.bold("Senaryo: SecureScan otomatik onay → TestRunner Pro kullanıcı onayı → GPU Burst limit reddi"));
  if (AUTO_APPROVE) log.info("--auto-approve açık: TestRunner Pro'yu owner key'iyle bu script onaylayacak");
  else log.wait("TestRunner Pro bekleyince panelde owner cüzdanıyla 'Onay bekleyenler' → Onayla");
  await new Promise((r) => setTimeout(r, OPEN ? 4000 : 500)); // panel açılıp event'leri okumaya başlasın

  const stopApprover = AUTO_APPROVE ? autoApprover(c) : () => {};
  try {
    await run(process.execPath, ["agent.js", TASK], {
      cwd: join(ROOT, "agent"),
      env: { ...process.env, FORCE_COLOR: "1", SERVICES_URL: `http://localhost:${SERVICES_PORT}` },
    });
  } finally {
    stopApprover();
  }

  console.log();
  if (args.has("--exit")) {
    log.ok("demo turu bitti · --exit: servisler ve panel kapatılıyor"); // otomatik testler için
    shutdown(0);
  }
  log.ok(`demo turu bitti · panel açık: ${panelUrl} · kapatmak için Ctrl+C`);
}

main().catch((err) => {
  log.fail(err.shortMessage ?? err.message);
  shutdown(1);
});
