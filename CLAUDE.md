# Proje: AgentGuard (Monad hackathon, tek günlük demo)

Ben öğrenciyim. Bu projeyle Solidity, viem ve React öğrenmek istiyorum.
- Her adımda önce ne yapacağını ve nedenini kısaca Türkçe açıkla.
- Büyük kod blokları yerine küçük adımlar ver, bir seferde tek özellik.
- Bazı kısımları bana bırak: "şunu sen dene" de, sonra kodumu incele.
- Yeni bir kavram geçtiğinde (402, ABI, event, nonce...) 2-3 cümleyle anlat.
- Her çalışan adımdan sonra commit önermeyi unutma.
- Zincir adımlarını (faucet, deploy, private key) ben yaparım: sen yönlendir, sonra `cast` ile doğrula.

## Fikir (varsayım: agentguard.md henüz yok, gelince burayı güncelle)
Bir yapay zekâ ajanı ücretli API'leri kullanırken para harcar. Servis önce
**HTTP 402 Payment Required** döner: "şu kadar MON, şu adrese öde" der. Ajan
doğrudan ödemez, **AgentGuard sözleşmesi** üzerinden öder. Sözleşme kuralları uygular:
- tek ödeme üst sınırı (ör. 0.01 MON)
- günlük bütçe (ör. 0.05 MON)
- sadece izinli servis adreslerine (allowlist) ödeme
- sahip her şeyi tek tuşla durdurabilir (pause)

Panel, sahibin bütçeyi, ödeme geçmişini ve engellenen denemeleri canlı görmesini sağlar.

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
1. **Sözleşme + testler**: `AgentGuard.sol` (deposit, pay, limitler, allowlist, pause,
   `Paid` / `Blocked` event'leri). `forge test` yeşil olana kadar sadece yerelde çalış.
2. **Testnet'e deploy**: Faucet'ten MON al, `forge script` ile deploy et, sözleşmeye
   bütçe yatır, servis adreslerini allowlist'e ekle. `cast call` ile doğrula.
3. **402 servisleri**: Express'te 2-3 uç nokta. Ödeme kanıtı yoksa 402 + fiyat + adres +
   requestId döner. Kanıt (tx hash) gelirse zincirden `Paid` event'ini kontrol edip 200 döner.
4. **Ajan scripti**: `agent.js` servisleri sırayla çağırır, 402 gelince `pay()` yapar, tx
   hash ile tekrar ister. Limit aşımı ve izinsiz servis senaryolarında reddedildiğini gösterir.
5. **Panel**: viem ile bütçe/harcanan/kalan, canlı ödeme akışı (event'ler), engellenenler,
   pause butonu ve limit ayarı (cüzdan bağlayarak). Tasarım `agentguard.html`'e göre.
6. **Demo provası**: 3 dakikalık senaryo (normal ödeme → limit aşımı engellendi → pause),
   README, explorer linkleri, yedek plan (RPC çökerse yedek RPC, ekran kaydı).

## Zaman kutusu (tek gün)
Adım 1-2: ~2 saat · Adım 3-4: ~2 saat · Adım 5: ~3 saat · Adım 6: ~1 saat.
Geride kalırsan önce paneldeki yazma özelliklerini (limit ayarı) kes, okuma kısmı yeter.
