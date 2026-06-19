# 🗺️ Mall Nav

Navigatore per centri commerciali: calcola il **percorso più breve** tra due negozi usando l'algoritmo di Dijkstra. Web app statica (HTML/CSS/JS vanilla), senza framework e senza build step.

**Produzione:** https://mallnav.netlify.app/

---

## ✨ Funzionalità

### 🏢 Multi-centro
- Selezione del centro commerciale da una griglia di card.
- Ogni centro ha i propri negozi, piani, zone e scale mobili.
- Architettura pensata per aggiungere nuovi centri (vedi sotto).

### 🎯 Calcolo percorso
- **Algoritmo di Dijkstra** su grafo pesato per il percorso più breve.
- **Multi-piano**: gestisce i cambi di piano tramite scale mobili (su/giù).
- **Multi-zona**: anello esterno + isole interne.
- **Tappe intermedie**: aggiungi più negozi da visitare lungo il percorso.
- **Percorso Efficiente**: riordina automaticamente le tappe per minimizzare la distanza totale (backtracking esatto per ≤7 tappe, greedy nearest-neighbor oltre).
- **Destinazione rapida: Bagno**: trova il bagno più vicino al punto di partenza.

### 🔎 Ricerca negozi
- Autocomplete sui campi Partenza / Destinazione / Tappa intermedia.
- Filtro per categoria (Moda, Food e Ristoranti, Salute e Bellezza, ecc.).
- Lista completa negozi in un modale, con ricerca e filtro per piano.

### 💾 Persistenza
- `sessionStorage` salva l'ultimo centro selezionato (ripristinato riaprendo la stessa scheda).
- `localStorage` usato solo per il consenso cookie.

---

## 📁 Struttura file

| File | Ruolo |
|---|---|
| `index.html` | Shell HTML, unica pagina funzionale del navigatore |
| `data.js` | Dati statici: `MALLS_CONFIG` + `MALLS_DATA` |
| `navigation.js` | Classe `NavigationService` (Dijkstra + costruzione grafo) |
| `app.js` | Logica UI: selezione mall, autocomplete, calcolo, rendering |
| `styles.css` | Tutti gli stili, responsive |
| `nav-menu.js` | Hamburger menu mobile |
| `cookie-consent.js` | Banner GDPR, gestisce Google Analytics/AdSense/Cloudflare |
| `about.html`, `faq.html`, `guida-shopping.html`, `come-funziona.html`, `privacy.html` | Pagine SEO statiche |
| `netlify.toml`, `_redirects` | Configurazione Netlify |
| `ads.txt`, `robots.txt`, `sitemap.xml`, `favicon.png` | Asset SEO/monetizzazione |
| `scripts/` | Script di test/debug locali (non inclusi in produzione) |

Ordine di caricamento script in `index.html`:
`data.js` → `navigation.js` → `app.js` → `nav-menu.js` → `cookie-consent.js`

---

## 🏗️ Struttura dati

### `MALLS_CONFIG` (array)
```js
{
    id: 'porta_di_roma',
    name: 'Porta di Roma',
    location: 'Roma, Italia',
    description: 'Il più grande centro commerciale di Roma',
    floors: 2,
    escalators: 4,
    totalShops: 199,
    logo: '🏛️'
    // comingSoon: true  → centro placeholder, non navigabile
}
```

### `MALLS_DATA` (oggetto keyed per id mall)
```js
'porta_di_roma': [
    { id: 'p0_outer_1', name: 'Nitò', floor: 0, zone: 'OUTER', position: 1, type: 'Food e Ristoranti' },
    // ...
]
```

**Zone valide:**
- `OUTER` — anello esterno (piano 0 e 1)
- `ISLAND_SX` — isola sinistra (piano 0)
- `ISLAND_DX` — isola destra (piano 0)
- `ISLAND_CENTER` — isola centrale (piano 1)
- `ISLAND_MINI` — mini-isola (non collegata in sequenza con le altre)

**Convenzione ID:**
- Porta di Roma: `p0_outer_*`, `p0_isl_sx_*`, `p0_isl_dx_*`, `p1_outer_*`, `p1_isl_center_*`
- GranRoma: `gr_*`

**Tipo speciale:** `type: 'Bagni'` → usato da `findNearestBathroom()`.

**Categorie `type`:** Moda, Food e Ristoranti, Salute e Bellezza, Cultura Regali Tempo Libero, Prodotti per la casa, Supermercati, Servizi, Bagni.

---

## 🧮 Algoritmo di navigazione (`navigation.js`)

Il grafo viene costruito da `NavigationService` e percorso con Dijkstra (priority queue).

### Pesi del grafo
| Connessione | Peso |
|---|---|
| Negozi consecutivi anello | 2 |
| Negozi consecutivi isola | 2 |
| Isola ↔ anello esterno | 3 |
| Negozio → nodo scale | 1 |
| Scale tra piani | 2 |

### Nodi virtuali scale
`stairs_left_p0`, `stairs_left_p1`, `stairs_right_p0`, `stairs_right_p1`.

Il centro in uso è rilevato dall'ID del primo negozio (`gr_*` = GranRoma, `p0_*`/`p1_*` = Porta di Roma): questo determina i negozi vicini alle scale e le connessioni isola-anello.

### Connessioni isola-anello
Definite manualmente in `getPortaDiRomaConnections()` e `getGranRomaConnections()`: ogni entry `{ islandShop, outerShops }` collega un negozio dell'isola ai negozi dell'anello esterno fisicamente adiacenti (sullo stesso piano).

---

## 🏬 Centri commerciali

| Mall | ID | Piano 0 | Piano 1 | Stato |
|---|---|---|---|---|
| Porta di Roma | `porta_di_roma` | OUTER + ISLAND_SX + ISLAND_DX | OUTER + ISLAND_CENTER | ✅ Attivo (199 negozi, 4 scale) |
| GranRoma | `granroma` | OUTER + ISLAND_CENTER | OUTER + ISLAND_CENTER + ISLAND_MINI | ✅ Attivo (93 negozi, 2 scale) |
| Altri centri | `altro_mall` | — | — | 🔜 `comingSoon`, placeholder |

---

## ➕ Aggiungere un nuovo centro commerciale

1. **`data.js` → `MALLS_CONFIG`**: aggiungi una entry con `id`, `name`, `location`, `description`, `floors`, `escalators`, `totalShops`, `logo`.
2. **`data.js` → `MALLS_DATA`**: aggiungi `'id_centro': [...]` con tutti i negozi (rispetta convenzione ID e zone).
3. **`navigation.js` → `getIslandConnections()`**: aggiungi un ramo per rilevare il nuovo mall (es. `firstShopId.startsWith('nc_')`) e implementa le sue connessioni isola-anello.
4. **`navigation.js` → `buildGraph()`**: aggiungi i negozi vicini a ciascuna scala del nuovo mall.

---

## 📈 Monetizzazione e SEO

- **Google AdSense** (`ca-pub-7840795594547987`) e **Google Analytics** caricati solo dopo consenso cookie.
- **Cloudflare Analytics** iniettato anch'esso solo dopo consenso analitico (beacon pixel, nessun cookie proprio).
- `ads.txt`, `robots.txt`, `sitemap.xml` presenti.
- Meta tag Open Graph, Twitter Card e Schema.org `WebApplication` su ogni pagina.
- Pagine SEO statiche (`guida-shopping.html`, `faq.html`, ecc.) senza logica JS.

---

## 🔐 Privacy & GDPR

- Privacy/Cookie policy in `privacy.html`.
- Banner consenso cookie (`cookie-consent.js`), chiave `localStorage` `mallNavCookieConsent`.
- Nessun dato personale memorizzato lato server: tutto client-side.

---

## 🚀 Deploy

Hosting 100% statico su **Netlify** con deploy automatico da repository. Nessuno step di build (`netlify.toml`); `_redirects` per la gestione degli URL. Essendo statico, è ospitabile anche su altri hosting (Vercel, GitHub Pages, ecc.).

---

## 📄 Licenza

Copyright (c) 2026 MallNav. **All rights reserved.**

Software proprietario e confidenziale: vietata riproduzione, distribuzione, modifica o utilizzo senza autorizzazione scritta. Vedere il file [LICENSE](LICENSE).

---

**Sviluppato con ❤️ per facilitare lo shopping nei centri commerciali**
