// Yapay zekâ ajanı (sahte): görevi alır, ücretli servisleri çağırır, ödemeyi AgentGuard'a sordurur.
// Çalıştırma: npm run agent -- "görev metni"
import { formatEther, keccak256, parseEventLogs, toBytes } from "viem";
import { REJECT_REASONS, guardAbi } from "./abi.js";
import { GUARD_ADDRESS, categoryHash, publicClient, txLink, walletClientFor } from "./chain.js";
import { logger, pc } from "./log.js";

const SERVICES_URL = process.env.SERVICES_URL ?? "http://localhost:4020";
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;

const log = logger("AJAN", pc.cyan);
const wallet = walletClientFor(process.env.AGENT_PRIVATE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ajanın "planı": görev için hangi servislere ihtiyaç var (demo için sabit)
const PLAN = [
  { slug: "securescan", name: "SecureScan" },
  { slug: "testrunner", name: "TestRunner Pro" },
  { slug: "gpuburst", name: "GPU Burst" },
];

function callService(slug, task, paymentTx) {
  return fetch(`${SERVICES_URL}/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(paymentTx && { "X-Payment-Tx": paymentTx }) },
    body: JSON.stringify({ task }),
  });
}

/** requestPayment'ı gönderir, makbuzdaki event'e göre kararı döner. */
async function requestPayment({ payTo, amount, category }, purposeHash) {
  const hash = await wallet.writeContract({
    address: GUARD_ADDRESS,
    abi: guardAbi,
    functionName: "requestPayment",
    args: [payTo, amount, categoryHash(category), purposeHash],
  });
  log.info(`tx gönderildi: ${txLink(hash)}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const events = parseEventLogs({ abi: guardAbi, logs: receipt.logs });

  const settled = events.find((e) => e.eventName === "Settled");
  if (settled) return { decision: "Settled", txHash: hash };

  const rejected = events.find((e) => e.eventName === "Rejected");
  if (rejected) return { decision: "Rejected", reason: REJECT_REASONS[rejected.args.reason] };

  const pending = events.find((e) => e.eventName === "PendingCreated");
  return { decision: "Pending", id: pending.args.id, fromBlock: receipt.blockNumber };
}

/** Owner'ın approvePending / rejectPending kararını event'lerden bekler. */
async function waitForOwner(id, fromBlock) {
  const started = Date.now();
  let from = fromBlock;
  let lastNotice = 0;

  while (Date.now() - started < PENDING_TIMEOUT_MS) {
    const latest = await publicClient.getBlockNumber();
    if (latest >= from) {
      const query = { address: GUARD_ADDRESS, abi: guardAbi, args: { id }, fromBlock: from, toBlock: latest };
      const [approved] = await publicClient.getContractEvents({ ...query, eventName: "PendingApproved" });
      if (approved) return { approved: true, txHash: approved.transactionHash };
      const [rejected] = await publicClient.getContractEvents({ ...query, eventName: "PendingRejected" });
      if (rejected) return { approved: false };
      from = latest + 1n; // sadece yeni bloklara bak: Monad'da getLogs aralığı sınırlı
    }

    const waited = Math.floor((Date.now() - started) / 1000);
    if (waited - lastNotice >= 15) {
      log.wait(`hâlâ owner onayı bekleniyor (#${id}, ${waited} sn)…`);
      lastNotice = waited;
    }
    await sleep(1000);
  }
  return { approved: false, timeout: true };
}

async function useService({ slug, name }, task) {
  console.log();
  log.step(`${pc.bold(name)} çağrılıyor`);

  const first = await callService(slug, task);
  if (first.status !== 402) {
    log.fail(`beklenmeyen cevap: HTTP ${first.status}`);
    return { name, result: "hata" };
  }

  const quote = await first.json();
  const amount = BigInt(quote.amount);
  log.pay(`402 Payment Required: ${formatEther(amount)} MON → ${quote.payTo.slice(0, 10)}… (${quote.category})`);

  // Ödemenin amacı: zincirde iz bırakır, panel ve servis hangi iş için ödendiğini eşleştirebilir
  const purposeHash = keccak256(toBytes(`${name}|${task}`));
  log.step("AgentGuard'dan ödeme izni isteniyor (requestPayment)");
  const outcome = await requestPayment({ ...quote, amount }, purposeHash);

  let paymentTx;
  if (outcome.decision === "Settled") {
    log.ok("AgentGuard: Settled, ödeme anında yapıldı");
    paymentTx = outcome.txHash;
  } else if (outcome.decision === "Rejected") {
    log.fail(`AgentGuard: Rejected (${outcome.reason}), bu servis atlanıyor`);
    return { name, result: `reddedildi: ${outcome.reason}` };
  } else {
    log.wait(`AgentGuard: Pending #${outcome.id}, servis allowlist'te değil, owner onayı bekleniyor`);
    const owner = await waitForOwner(outcome.id, outcome.fromBlock);
    if (!owner.approved) {
      log.fail(owner.timeout ? "owner zamanında cevap vermedi, atlanıyor" : "owner reddetti, bu servis atlanıyor");
      return { name, result: owner.timeout ? "zaman aşımı" : "owner reddetti" };
    }
    log.ok(`owner onayladı, ödeme yapıldı: ${txLink(owner.txHash)}`);
    paymentTx = owner.txHash;
  }

  log.step(`${name} ödeme kanıtıyla tekrar çağrılıyor (X-Payment-Tx)`);
  const second = await callService(slug, task, paymentTx);
  const body = await second.json();
  if (!second.ok) {
    log.fail(`servis ödemeyi kabul etmedi: ${body.error}`);
    return { name, result: "ödeme kabul edilmedi" };
  }
  log.ok(`rapor alındı: ${JSON.stringify(body.report)}`);
  return { name, result: `ödendi (${formatEther(amount)} MON)` };
}

async function main() {
  const task = process.argv.slice(2).join(" ") || "AgentGuard sözleşmesini denetle ve testlerini koştur";
  log.step(`görev: ${pc.bold(task)}`);
  log.info(`ajan ${wallet.account.address} · AgentGuard ${GUARD_ADDRESS}`);
  log.info(`plan: ${PLAN.map((s) => s.name).join(" → ")}`);

  const results = [];
  for (const service of PLAN) {
    try {
      results.push(await useService(service, task));
    } catch (err) {
      log.fail(`${service.name}: ${err.shortMessage ?? err.message}`);
      results.push({ name: service.name, result: "hata" });
    }
  }

  const read = (functionName) => publicClient.readContract({ address: GUARD_ADDRESS, abi: guardAbi, functionName });
  const [spent, remaining] = await Promise.all([read("spent"), read("remainingBudget")]);

  console.log();
  log.step(pc.bold("Özet"));
  for (const r of results) log.info(`${r.name.padEnd(15)} ${r.result}`);
  log.info(`harcanan: ${formatEther(spent)} MON · kalan bütçe: ${formatEther(remaining)} MON`);
}

main().catch((err) => {
  log.fail(err.shortMessage ?? err.message);
  process.exit(1);
});
