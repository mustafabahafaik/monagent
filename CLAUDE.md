# Proje: AgentGuard (Monad hackathon, tek günlük demo)

Ben öğrenciyim. Bu projeyle Solidity, viem ve React öğrenmek istiyorum.
- Her adımda önce ne yapacağını ve nedenini kısaca Türkçe açıkla.
- Büyük kod blokları yerine küçük adımlar ver, bir seferde tek özellik.
- Bazı kısımları bana bırak: "şunu sen dene" de, sonra kodumu incele.
- Yeni bir kavram geçtiğinde (402, ABI, event, nonce...) 2-3 cümleyle anlat.
- Her çalışan adımdan sonra commit önermeyi unutma.
- Zincir adımlarını (faucet, deploy, private key) ben yaparım: sen yönlendir, sonra `cast` ile doğrula.

## Fikir
Bir yapay zekâ ajanı ücretli API'leri kullanırken para harcar. Servis önce
**HTTP 402 Payment Required** döner: "şu kadar MON, şu adrese öde" der. Ajan
doğrudan ödemez, `AgentGuard.requestPayment(provider, amount, category, purposeHash)`
çağırır; sözleşme kendi bakiyesinden öder. Owner kuralları koyar: `perTxLimit`,
`totalBudget`, izinli alıcılar (allowlist), izinli kategoriler (scope).

Karar yolları (`contracts/src/AgentGuard.sol`):
- limit / bütçe / kapsam / bakiye ihlali → `Rejected` event (revert yok, deneme zincirde görünür)
- provider allowlist'te değil → `Pending` kaydı + `PendingCreated`; owner `approvePending` /
  `rejectPending` ile karar verir, onaylanan provider allowlist'e eklenir
- hepsi uygun → anında transfer + `Settled`
- `category` ve `purposeHash` bytes32; servis, 402 requestId'sini `purposeHash` ile eşleştirir.

Panel, owner'ın bütçeyi, ödeme akışını, bekleyen onayları ve reddedilenleri canlı görmesini sağlar.

## Teknoloji
- `contracts/`: Foundry, Solidity
- `agent/`: Node + Express (402 dönen sahte servisler) + ajan scripti (viem, ESM)
- `frontend/`: Vite + React + TypeScript + viem (panel)
- Tasarım referansı: `agentguard.html` (henüz yok)

## Ağ: Monad Testnet (docs.monad.xyz'den doğrulandı, 2026-10-23)
- Chain ID: 10143, para birimi: MON
- RPC: https://testnet-rpc.monad.xyz (yedek: https://rpc-testnet.monadinfra.com)
- Explorer: https://testnet.monadvision.com, https://testnet.monadscan.com
- Faucet: https://faucet.monad.xyz

## Klasör yapısı
```
agentguard/
├── CLAUDE.md
├── contracts/
│   ├── .env              # PRIVATE_KEY (owner), AGENT_ADDRESS, PROVIDER_* (git'e girmez)
│   ├── src/AgentGuard.sol
│   ├── test/AgentGuard.t.sol
│   └── script/Deploy.s.sol   # deploy + frontend/src/config.ts ve agent/config.js'i yazar
├── agent/                # npm run services · npm run agent -- "görev"
│   ├── .env              # AGENT_PRIVATE_KEY, PROVIDER_* adres/key (git'e girmez)
│   ├── config.js         # ÜRETİLİR: Deploy.s.sol yazar, elle düzenleme
│   ├── chain.js          # viem client'ları; RPC_URL/GUARD_ADDRESS env ile ezilebilir
│   ├── abi.js · log.js   # okunabilir ABI (parseAbi) · renkli logger
│   ├── services.js       # :4020 SecureScan / TestRunner Pro / GPU Burst
│   └── agent.js          # 402 al → requestPayment → (Pending ise event bekle) → X-Payment-Tx ile tekrar
└── frontend/             # Vite + React + TS + viem · npm run dev (önizleme: 5180)
    ├── public/mascot.png # kullanıcının maskotu (daire, şeffaf kenar)
    └── src/
        ├── config.ts     # ÜRETİLİR: Deploy.s.sol yazar, elle düzenleme
        ├── lib/          # chain (client, explorer, etiketler), abi, wallet, format
        ├── hooks/        # useGuard (durum, multicall, 3 sn) · useActivity (event akışı)
        └── components/   # OrbitCard (kapsül: başlık+özet, tıklayınca detay), Mascot (takla/tepki
                          # animasyonları), Backdrop (yıldız + parallax), Skyline (Atakule/Anıtkabir);
                          # detay gövdeleri: FlowCard, Rules, PendingList, Summary, ActivityFeed, Stats
```
config.ts / config.js repoda sıfır adresli yer tutucu olarak durur: Foundry, var olmayan
klasöre yazamıyor (fs_permissions). Vite iskeletini kurarken `frontend/src/config.ts`'i silme.

## 6 adımlık plan (her adım sonunda commit)
1. **Sözleşme + testler** ✅: `AgentGuard.sol` + 20 test, her karar yolu kapsanıyor (`forge test`).
2. **Testnet'e deploy** ✅: `forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --gas-estimate-multiplier 200`
   (pay şart: Foundry gas'ı Ethereum tablosuyla tahmin ediyor, 2026-10-23'te kasaya yatırma out-of-gas ile düştü)
   (simülasyon için --broadcast'sız; config dosyaları sadece yayında yazılır). `cast call` ile doğrula.
   Ayarlar (1 birim = 0.01 MON): perTx 5, budget 20, allowlist [SecureScan, LintBot],
   scope [security, test, lint]. Kasaya bütçenin tamamı (0.2 MON) yatırılır.
3. **402 servisleri** ✅ (testnet'te çalıştı): ödemesiz → 402 {amount (wei, string), payTo, category}.
   X-Payment-Tx → makbuzda GUARD_ADDRESS'ten gelen, payTo/tutar/kategori eşleşen `Settled` aranır;
   aynı tx ikinci kez kabul edilmez (bellekte). Demo: SecureScan 0.02 security (allowlist → Settled),
   TestRunner Pro 0.03 test (allowlist dışı → Pending), GPU Burst 0.08 compute (perTx aşımı → Rejected).
4. **Ajan scripti** ✅ (testnet'te çalıştı): Pending'de PendingApproved/PendingRejected event'ini 1 sn'de bir
   yeni bloklarda arar (10 dk zaman aşımı); onayda approve tx'inin hash'ini servise gönderir.
5. **Panel** 🟡: veri katmanı ve bileşenler çalışıyor (testnet'te canlı doğrulandı). Özet/limit/allowlist/
   scope/pending sözleşme durumundan (multicall), işlem akışı event'lerden. Onayla/Reddet önce simulate,
   sonra cüzdanla approvePending/rejectPending (gerçek cüzdanla henüz denenmedi).
   Tasarım (2026-10-23, kullanıcının referans görsellerinden): mor-mavi gece teması, ortada maskot
   (public/mascot.png, kullanıcının verdiği ekran görüntüsünden daire kırpıldı), iki yanında SVG Atakule +
   Anıtkabir, arka planda dönen Monad amblemleri ve şehir silüeti. agentguard.html hiç verilmedi.
6. **Demo provası** ✅ (npm run demo, testnet'te 2 tur): 3 dakikalık senaryo (normal ödeme → limit aşımı reddedildi → yeni servis Pending → owner onayı),
   README, explorer linkleri, yedek plan (RPC çökerse yedek RPC, ekran kaydı).

## Monad public RPC sınırları (2026-10-23'te ölçüldü)
- `eth_getLogs` en fazla **100 blok** (testnet-rpc.monad.xyz ve rpc-testnet.monadinfra.com ikisi de).
  Zincir ~2.7 blok/sn → panel geçmişin tamamını değil son ~2400 bloğu (~15 dk) okuyor, sonra canlı takip.
- Saniyede **15 istek**: JSON-RPC batch'teki her çağrı ayrı sayılır. Okumalar Multicall3 ile
  (`0xcA11bde05977b3631167028862bE2a173976CA11`, testnet'te kurulu) tek eth_call'a toplanıyor.

## Zaman kutusu (tek gün)
Adım 1-2: ~2 saat · Adım 3-4: ~2 saat · Adım 5: ~3 saat · Adım 6: ~1 saat.
Geride kalırsan önce paneldeki yazma özelliklerini (limit ayarı) kes, okuma kısmı yeter.

## Testnet durumu (2026-10-23)
- AgentGuard: `0x88015611D942479441fC72B35794F503cE538B0D` (demo:fresh ile deploy; sourcify verify YAPILMADI)
- owner: `0x3bC0672612EfD112FB765f73dC3BE1F82E5a4435` (~1.9 MON kaldı; her deploy ~0.8 MON yakıyor → faucet)
- agent: `0x3ecD4dbfC1cfeAa12213A74662C17F18a33e5881` · SecureScan `0x8bb1…A74b` · LintBot `0x0365…C6e2`
  · TestRunner Pro `0x0309…5255` · GPU Burst `0xa338…591c`
- İki demo turu yapıldı: spent 0.1 / 0.2 MON. `npm run demo` her turdan önce sahneyi kendisi hazırlar
  (TestRunner'ı allowlist'ten çıkarır, bütçe/kasa/ajan gas'ı yetmezse tamamlar).
- Eski sözleşmeler (0x95DC…7184, 0x893E…7452) boşaltıldı, kullanılmıyor.
- Key'ler sadece `contracts/.env` ve `agent/.env` içinde (ikisi de gitignore'da).

## Demo komutları (kökten)
- `npm run demo` → sahne hazırlığı + servisler (:4020) + panel (:5180, tarayıcıda açılır) + ajan.
  TestRunner Pro'yu kullanıcı panelden owner cüzdanıyla onaylar.
- `npm run demo:rehearse` → aynısı, onayı script verir (--auto-approve). `--no-open`, `--exit` bayrakları var.
- `npm run demo:fresh` → eski kasayı owner'a boşaltıp yeniden deploy eder.

## Monad tuzakları (2026-10-23'te yaşandı)
- **Reserve balance**: bakiyesi < 10 MON olan EOA, son 3 blokta işlem gönderdiyse MON transfer edemez
  → işlem revert, gas kesilir, gasUsed = gasLimit görünür (out-of-gas sanılır!). forge script'in art arda
  gönderdiği deposit bu yüzden düştü. Deploy.s.sol artık deposit yapmaz; demo.js sendValue 4 blok bekler.
- Vite Windows'ta ::1'e (IPv6) bağlanıyor: port yoklaması 127.0.0.1 ile değil localhost ile yapılmalı.
