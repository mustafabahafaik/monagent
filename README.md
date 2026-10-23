# AgentGuard

Yapay zekâ ajanları ücretli API'leri kendi başına kullanmaya başladı. Ama ajana cüzdanını
verirsen ne kadar, kime, ne için harcayacağını kontrol edemezsin. **AgentGuard**, ajanın
harcama yetkisini Monad üzerindeki bir sözleşmeyle sınırlar:

- Servis **HTTP 402 Payment Required** döner ("0.02 MON, şu adrese").
- Ajan parayı kendisi göndermez, `AgentGuard.requestPayment(...)` çağırır.
- Sözleşme kurallara bakıp karar verir:
  - limit / bütçe / kapsam ihlali → **Rejected** (para çıkmaz, deneme zincirde kayıtlı)
  - tanınmayan servis → **Pending** (owner panelden onaylar ya da reddeder)
  - her şey uygun → **Settled** (anında ödeme)
- Servis, ödeme tx'ini zincirden doğrular ve cevabı verir.

## Monad Testnet

| | |
|---|---|
| AgentGuard | [`0x88015611D942479441fC72B35794F503cE538B0D`](https://testnet.monadvision.com/address/0x88015611D942479441fC72B35794F503cE538B0D) |
| Chain ID | 10143 |
| Kurallar | tek işlem 0.05 MON · toplam bütçe 0.2 MON · kapsam: security, test, lint |

## Demo

```bash
npm run setup     # agent/ ve frontend/ bağımlılıkları (bir kez)
npm run demo      # servisler + panel + ajan, tek komut
```

`npm run demo` sırasıyla:

1. Sözleşme yoksa deploy eder (`npm run demo:fresh` her seferinde yeniden deploy eder).
2. Sahneyi hazırlar: TestRunner Pro allowlist dışında, bütçe/kasa/ajan gas'ı bir tura yeter.
3. 402 servislerini (`:4020`) ve paneli (`:5180`) başlatır, paneli tarayıcıda açar.
4. Ajanı çalıştırır:

| Servis | Fiyat | Kategori | AgentGuard kararı |
|---|---|---|---|
| SecureScan | 0.02 MON | security | allowlist'te → **otomatik onay** |
| TestRunner Pro | 0.03 MON | test | allowlist dışı → **panelden kullanıcı onayı** |
| GPU Burst | 0.08 MON | compute | tek işlem limiti (0.05) aşıldı → **reddedildi** |

TestRunner Pro beklerken panelde owner cüzdanını bağla → **Onay bekleyenler** → **Onayla**.
Prova ya da ekran kaydı için `npm run demo:rehearse` onayı owner key'iyle kendisi verir.

## Yapı

```
contracts/   Foundry · AgentGuard.sol + 20 test (npm test) · script/Deploy.s.sol
agent/       Express 402 servisleri · ajan (viem) · demo.js (tek komut orkestrasyonu)
frontend/    Vite + React + viem · canlı panel (sözleşme durumu + event akışı, cüzdanla onay)
```

Kurulum için `contracts/.env` (owner key, ajan/servis adresleri) ve `agent/.env` (ajan key'i,
servis adresleri) gerekir; şablon: `contracts/.env.example`.

## Monad'da öğrendiklerimiz

- **Reserve balance:** Bakiyesi 10 MON'un altındaki bir hesap, son 3 blokta başka işlem
  gönderdiyse MON transfer edemez; işlem revert olur, gas yine kesilir. Deploy scripti bu
  yüzden kasaya para yatırmaz; `demo.js` para gönderen her işlemden önce 4 blok bekler.
- **eth_getLogs 100 blokla sınırlı** ve public RPC saniyede 15 istek kabul ediyor: panel
  durumu Multicall3 ile tek çağrıda okur, event geçmişinin son ~15 dakikasını tarar.
- Monad başarısız işlemde gas limitinin tamamını harcanmış gösterir; bu, out-of-gas ile
  karıştırılabiliyor.
