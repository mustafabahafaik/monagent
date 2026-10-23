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
└── frontend/             # Vite + React + TS
    └── src/config.ts     # ÜRETİLİR: Deploy.s.sol yazar, elle düzenleme
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
5. **Panel**: viem ile bütçe/harcanan/kalan, canlı ödeme akışı (event'ler), engellenenler,
   bekleyen ödemeleri onayla/reddet ve limit ayarı (cüzdan bağlayarak). Tasarım `agentguard.html`'e göre.
6. **Demo provası**: 3 dakikalık senaryo (normal ödeme → limit aşımı reddedildi → yeni servis Pending → owner onayı),
   README, explorer linkleri, yedek plan (RPC çökerse yedek RPC, ekran kaydı).

## Zaman kutusu (tek gün)
Adım 1-2: ~2 saat · Adım 3-4: ~2 saat · Adım 5: ~3 saat · Adım 6: ~1 saat.
Geride kalırsan önce paneldeki yazma özelliklerini (limit ayarı) kes, okuma kısmı yeter.

## Testnet durumu (2026-10-23)
- AgentGuard: `0x893E5bd8b1EB691348546c72b46cCb68D00B7452` (MonadVision'da doğrulandı, sourcify)
  https://testnet.monadvision.com/address/0x893E5bd8b1EB691348546c72b46cCb68D00B7452 · DEPLOY_BLOCK 73524210
- owner: `0x3bC0672612EfD112FB765f73dC3BE1F82E5a4435` (monad-racer deployer'ı ile aynı)
- agent: `0x3ecD4dbfC1cfeAa12213A74662C17F18a33e5881` (gas: bir demo turu ~0.033 MON)
- SecureScan `0x8bb16e6aab06B29C00b612f404ceb5da4497A74b` · LintBot `0x03657f0220e9308c4f6D38a212AE7EFbF92AC6e2` (allowlist)
- TestRunner Pro `0x03090b1309907c668acb68eC45413ac70F5b5255` · GPU Burst `0xa338deF760FE72f34fC431f4841A5bAD7ce1591c`
- İlk demo turu yapıldı: spent 0.05 / 0.2 MON, pending #1 onaylandı → **TestRunner artık allowlist'te**.
  Pending sahnesini tekrar göstermek için demo öncesi: `cast send <GUARD> 'setProvider(address,bool)' <TESTRUNNER> false`.
  Her tur 0.05 MON harcar: 3 tur sonra bütçe biter (OverBudget). Gerekirse `setLimits` ile bütçeyi artır.
- Eski deneme sözleşmesi `0x95DC…7184` boşaltıldı (0.1 MON owner'a döndü), kullanılmıyor.
- Key'ler sadece `contracts/.env` ve `agent/.env` içinde (ikisi de gitignore'da).
