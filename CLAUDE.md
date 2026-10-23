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
- `server/`: Node + Express (402 dönen sahte servisler) + ajan scripti (viem)
- `panel/`: Vite + React + viem
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
├── README.md
├── contracts/            # forge init ile oluşur
│   ├── src/AgentGuard.sol
│   ├── test/AgentGuard.t.sol
│   └── script/Deploy.s.sol
├── server/
│   ├── package.json
│   ├── .env              # AGENT_PRIVATE_KEY, GUARD_ADDRESS (git'e girmez!)
│   ├── services.js       # 402 dönen sahte API'ler (hava durumu, çeviri...)
│   ├── agent.js          # 402 al → sözleşmeyle öde → tekrar iste
│   └── abi.js
└── panel/                # npm create vite ile oluşur
    └── src/
        ├── App.jsx
        ├── chain.js      # viem client'ları, Monad testnet tanımı
        └── abi.js
```

## 6 adımlık plan (her adım sonunda commit)
1. **Sözleşme + testler** ✅: `AgentGuard.sol` + 20 test, her karar yolu kapsanıyor (`forge test`).
2. **Testnet'e deploy** ✅: Faucet'ten MON al, `forge script` ile deploy et, sözleşmeye
   bütçe yatır, servis adreslerini allowlist'e ekle. `cast call` ile doğrula.
3. **402 servisleri**: Express'te 2-3 uç nokta. Ödeme kanıtı yoksa 402 + fiyat + adres +
   requestId döner. Kanıt (tx hash) gelirse zincirden `Settled` event'ini (purposeHash eşleşmeli) kontrol edip 200 döner.
4. **Ajan scripti**: `agent.js` servisleri sırayla çağırır, 402 gelince `requestPayment()` çağırır, tx
   hash ile tekrar ister. Limit aşımı ve izinsiz servis senaryolarında reddedildiğini gösterir.
5. **Panel**: viem ile bütçe/harcanan/kalan, canlı ödeme akışı (event'ler), engellenenler,
   bekleyen ödemeleri onayla/reddet ve limit ayarı (cüzdan bağlayarak). Tasarım `agentguard.html`'e göre.
6. **Demo provası**: 3 dakikalık senaryo (normal ödeme → limit aşımı reddedildi → yeni servis Pending → owner onayı),
   README, explorer linkleri, yedek plan (RPC çökerse yedek RPC, ekran kaydı).

## Zaman kutusu (tek gün)
Adım 1-2: ~2 saat · Adım 3-4: ~2 saat · Adım 5: ~3 saat · Adım 6: ~1 saat.
Geride kalırsan önce paneldeki yazma özelliklerini (limit ayarı) kes, okuma kısmı yeter.

## Testnet durumu (2026-10-23)
- AgentGuard: `0x95DC88A2161226bCCF6A0f26A0b6a8A055cD7184` (MonadVision'da doğrulandı, sourcify)
  https://testnet.monadvision.com/address/0x95DC88A2161226bCCF6A0f26A0b6a8A055cD7184
- owner: `0x3bC0672612EfD112FB765f73dC3BE1F82E5a4435` (monad-racer deployer'ı ile aynı)
- agent: `0x3ecD4dbfC1cfeAa12213A74662C17F18a33e5881` (key: server/.env AGENT_PRIVATE_KEY)
- provider weather (allowlist'te): `0x6416118B3e7e90F5DBb6Bf61dd2B9899bDa749ED`
- provider translate (allowlist'te değil → Pending demosu): `0x6F2287fef14eBD17ddE2FA67c97098AB19c90072`
- Kurallar: perTx 0.01 MON, totalBudget 0.05 MON, kategoriler `data` ve `ai` (keccak256), `gambling` kapalı
- Key'ler sadece `contracts/.env` ve `server/.env` içinde (ikisi de gitignore'da).
