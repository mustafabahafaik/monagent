// 402 dönen sahte servisler. Çalıştırma: npm run services
import express from "express";
import { formatEther, isHash, parseEther, parseEventLogs } from "viem";
import { guardAbi } from "./abi.js";
import { GUARD_ADDRESS, categoryHash, publicClient } from "./chain.js";
import { logger, pc } from "./log.js";

const PORT = Number(process.env.SERVICES_PORT ?? 4020);

// Demo senaryosu: SecureScan allowlist'te (anında öder), TestRunner Pro değil (owner onayı),
// GPU Burst hem perTx limitini (0.05) aşar hem de "compute" kapsam dışında (reddedilir).
const SERVICES = [
  {
    slug: "securescan",
    name: "SecureScan",
    payTo: process.env.PROVIDER_SECURESCAN,
    price: parseEther("0.02"),
    category: "security",
    report: (task) => ({
      task,
      findings: [
        { severity: "high", title: "Reentrancy riski: withdraw() durumu transferden sonra güncelliyor" },
        { severity: "low", title: "Event'lerde indexed alan eksik" },
      ],
      score: 82,
    }),
  },
  {
    slug: "testrunner",
    name: "TestRunner Pro",
    payTo: process.env.PROVIDER_TESTRUNNER,
    price: parseEther("0.03"),
    category: "test",
    report: (task) => ({ task, passed: 47, failed: 2, coverage: "91.4%", slowest: "test_Settlement (840ms)" }),
  },
  {
    slug: "gpuburst",
    name: "GPU Burst",
    payTo: process.env.PROVIDER_GPUBURST,
    price: parseEther("0.08"),
    category: "compute",
    report: (task) => ({ task, gpu: "8x H100", minutes: 30, jobId: "gpu-" + Date.now() }),
  },
];

for (const s of SERVICES) {
  if (!s.payTo) throw new Error(`${s.name} için payTo adresi yok: agent/.env içinde PROVIDER_* değişkenlerine bak`);
}

// Aynı ödeme tx'i iki kez kullanılamasın (bellekte tutuluyor: sunucu yeniden başlarsa sıfırlanır)
const usedTx = new Set();

/** Tx makbuzunda bu servise yapılmış, yeterli tutarda bir Settled event'i var mı? */
async function verifyPayment(service, txHash) {
  if (!isHash(txHash)) return "X-Payment-Tx geçerli bir tx hash değil";
  if (usedTx.has(txHash.toLowerCase())) return "bu ödeme zaten kullanıldı";

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return "tx zincirde bulunamadı";
  }
  if (receipt.status !== "success") return "tx başarısız olmuş";

  const settled = parseEventLogs({ abi: guardAbi, eventName: "Settled", logs: receipt.logs }).find(
    (e) =>
      e.address.toLowerCase() === GUARD_ADDRESS.toLowerCase() && // sahte bir sözleşmenin event'i olmasın
      e.args.provider.toLowerCase() === service.payTo.toLowerCase() &&
      e.args.amount >= service.price &&
      e.args.category === categoryHash(service.category),
  );
  if (!settled) return "tx'te bu servise ait uygun bir Settled event'i yok";

  usedTx.add(txHash.toLowerCase());
  return null; // hata yok
}

const app = express();
app.use(express.json());

for (const service of SERVICES) {
  const log = logger(service.name, pc.magenta);

  app.post(`/${service.slug}`, async (req, res) => {
    const task = req.body?.task ?? "";
    const txHash = req.get("X-Payment-Tx");

    if (!txHash) {
      log.pay(`ödemesiz istek → 402 (${formatEther(service.price)} MON, ${service.category})`);
      return res.status(402).json({
        amount: service.price.toString(), // wei, string: JSON BigInt taşıyamaz
        payTo: service.payTo,
        category: service.category,
      });
    }

    log.step(`ödeme kanıtı geldi: ${txHash.slice(0, 10)}… zincirden doğrulanıyor`);
    const error = await verifyPayment(service, txHash);
    if (error) {
      log.fail(`ödeme geçersiz: ${error}`);
      return res.status(402).json({
        error,
        amount: service.price.toString(),
        payTo: service.payTo,
        category: service.category,
      });
    }

    log.ok("ödeme doğrulandı → 200, rapor gönderiliyor");
    res.json({ service: service.name, report: service.report(task) });
  });
}

app.listen(PORT, () => {
  const log = logger("SERVİSLER", pc.magenta);
  log.ok(`http://localhost:${PORT} dinleniyor · AgentGuard ${GUARD_ADDRESS}`);
  for (const s of SERVICES) {
    log.info(`POST /${s.slug.padEnd(10)} ${s.name.padEnd(15)} ${formatEther(s.price)} MON · ${s.category} → ${s.payTo}`);
  }
});
