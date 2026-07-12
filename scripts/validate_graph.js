// Harness di validazione dati+grafo (tool locale, non pubblicato).
// Da lanciare dopo ogni modifica a data.js o navigation.js:
//   node scripts/validate_graph.js
// Contromisura al "guard silenzioso" di buildGraph: le connessioni isola-anello
// e scale matchano per NOME ESATTO e vengono scartate senza errore se il nome
// non risolve — qui ogni nome irrisolto/ambiguo diventa un problema esplicito.
const fs = require('fs');
const vm = require('vm');

const root = __dirname + '/../assets/js/';
vm.createContext(global);
const MALLS_DATA = new vm.Script(fs.readFileSync(root + 'data.js', 'utf8') + '\n;MALLS_DATA;', { filename: 'data.js' }).runInThisContext();
const NavigationService = new vm.Script(fs.readFileSync(root + 'navigation.js', 'utf8') + '\n;NavigationService;', { filename: 'navigation.js' }).runInThisContext();

let problems = 0;
function warn(mall, cat, msg) { problems++; console.log(`[${mall}] ${cat}: ${msg}`); }

for (const [mallId, shops] of Object.entries(MALLS_DATA)) {
    if (!Array.isArray(shops) || shops.length === 0) continue;
    console.log(`\n===== ${mallId} (${shops.length} negozi) =====`);

    // 1. ID duplicati
    const idCount = new Map();
    shops.forEach(s => idCount.set(s.id, (idCount.get(s.id) || 0) + 1));
    [...idCount].filter(([, c]) => c > 1).forEach(([id, c]) => warn(mallId, 'ID-DUP', `id "${id}" x${c}`));

    // 2. Nomi duplicati nel mall (rilevante: match per nome in navigation.js)
    const nameCount = new Map();
    shops.forEach(s => {
        if (!nameCount.has(s.name)) nameCount.set(s.name, []);
        nameCount.get(s.name).push(s);
    });
    [...nameCount].filter(([, arr]) => arr.length > 1).forEach(([name, arr]) =>
        warn(mallId, 'NOME-DUP', `"${name}" x${arr.length} (${arr.map(s => `${s.id} p${s.floor} ${s.zone}`).join(' | ')})`));

    // 3. Campi/zone/position
    const validZones = ['OUTER', 'ISLAND_SX', 'ISLAND_DX', 'ISLAND_CENTER', 'ISLAND_MINI'];
    const posSeen = new Map();
    shops.forEach(s => {
        if (!validZones.includes(s.zone)) warn(mallId, 'ZONA', `${s.id} "${s.name}" zona invalida: ${s.zone}`);
        if (typeof s.position !== 'number') warn(mallId, 'POS', `${s.id} position non numerica: ${s.position}`);
        if (!s.type) warn(mallId, 'TYPE', `${s.id} "${s.name}" senza type`);
        const pk = `${s.floor}_${s.zone}_${s.position}`;
        if (posSeen.has(pk)) warn(mallId, 'POS-DUP', `position ${s.position} duplicata in piano${s.floor}/${s.zone}: "${posSeen.get(pk)}" e "${s.name}"`);
        else posSeen.set(pk, s.name);
    });

    const nav = new NavigationService(shops, mallId);

    // 4. Connessioni isola-anello: nomi irrisolti + ambigui + zona sospetta
    nav.getIslandConnections().forEach(({ islandShop, outerShops }) => {
        const islandMatches = shops.filter(s => s.name === islandShop);
        if (islandMatches.length === 0) { warn(mallId, 'ISOLA-404', `islandShop "${islandShop}" non esiste in data.js`); return; }
        if (islandMatches.length > 1) warn(mallId, 'ISOLA-AMBIGUO', `islandShop "${islandShop}" matcha ${islandMatches.length} negozi (find prende il primo: ${islandMatches[0].id})`);
        const island = islandMatches[0];
        if (island.zone === 'OUTER') warn(mallId, 'ISOLA-ZONA', `islandShop "${islandShop}" (${island.id}) è zona OUTER, non isola`);
        outerShops.forEach(outerName => {
            const outerMatches = shops.filter(s => s.name === outerName && s.floor === island.floor);
            if (outerMatches.length === 0) {
                const anyFloor = shops.filter(s => s.name === outerName);
                if (anyFloor.length > 0) warn(mallId, 'OUTER-PIANO', `"${islandShop}" → outer "${outerName}" esiste solo su piano ${anyFloor.map(s => s.floor).join(',')} ≠ piano isola ${island.floor} → connessione SCARTATA in silenzio`);
                else warn(mallId, 'OUTER-404', `"${islandShop}" → outer "${outerName}" non esiste in data.js → connessione SCARTATA in silenzio`);
            } else if (outerMatches.length > 1) {
                warn(mallId, 'OUTER-AMBIGUO', `"${islandShop}" → outer "${outerName}" matcha ${outerMatches.length} negozi stesso piano`);
            }
        });
    });

    // 5. Scale: ogni nodo scala deve avere vicini-negozio del piano giusto
    ['stairs_left_p0', 'stairs_left_p1', 'stairs_right_p0', 'stairs_right_p1'].forEach(stair => {
        const neigh = Object.keys(nav.graph[stair] || {}).filter(id => !id.startsWith('stairs_'));
        const floor = stair.endsWith('p0') ? 0 : 1;
        if (neigh.length === 0) warn(mallId, 'SCALA-VUOTA', `${stair} non ha negozi collegati`);
        neigh.forEach(id => {
            const s = nav.shopById.get(id);
            if (s && s.floor !== floor) warn(mallId, 'SCALA-PIANO', `${stair} collegata a "${s.name}" che sta al piano ${s.floor}`);
        });
        console.log(`  ${stair}: ${neigh.length} negozi collegati`);
    });

    // 6. Connettività: BFS dal primo negozio, tutti raggiungibili?
    const start = shops[0].id;
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
        const cur = q.shift();
        Object.keys(nav.graph[cur] || {}).forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } });
    }
    const unreachable = shops.filter(s => !seen.has(s.id));
    if (unreachable.length) {
        unreachable.forEach(s => warn(mallId, 'ISOLATO', `"${s.name}" (${s.id}, p${s.floor} ${s.zone}) NON raggiungibile`));
    } else {
        console.log(`  Connettività: OK (tutti i ${shops.length} negozi raggiungibili)`);
    }

    // 7. Bagni
    const baths = shops.filter(s => s.type === 'Bagni');
    console.log(`  Bagni: ${baths.length} (${baths.map(b => `p${b.floor}`).join(', ')})`);

    // 8. Negozi con 0 archi
    shops.forEach(s => {
        if (Object.keys(nav.graph[s.id] || {}).length === 0) warn(mallId, 'ZERO-ARCHI', `"${s.name}" (${s.id}) ha 0 connessioni`);
    });
}

console.log(`\n>>> Problemi totali: ${problems}`);
process.exitCode = problems > 0 ? 1 : 0;
