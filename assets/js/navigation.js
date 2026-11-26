// Copyright (c) 2026 Trovalo. All rights reserved. Unauthorized use prohibited.
// Algoritmo di navigazione con Dijkstra
class NavigationService {
    // mallData = MALLS_DATA[id]: { shops, stairs, links, detours } (vedi data.js).
    // Un solo argomento: negozi e dati del grafo arrivano insieme dallo stesso oggetto,
    // quindi non si possono abbinare per errore i negozi di un centro alle scale di un altro.
    // Il codice è uguale per tutti i centri: ogni differenza sta nei dati.
    constructor(mallData) {
        if (!mallData || !Array.isArray(mallData.shops)) {
            throw new Error('NavigationService: serve l\'oggetto del centro { shops, stairs, links, detours }');
        }
        const shops = mallData.shops;
        this.shops = shops;
        this.stairs = mallData.stairs || [];
        this.links = mallData.links || [];
        this.detours = mallData.detours || [];
        // Indice per id: evita i .find() lineari ripetuti in _pathToSteps/findShortestPathById
        this.shopById = new Map(shops.map(s => [s.id, s]));
        this.WEIGHT_SAME_RING = 2;
        this.WEIGHT_ISLAND_RING = 2; // Stesso peso per isole (può essere conveniente)
        this.WEIGHT_CROSS_ISLAND = 3; // Peso per entrare/uscire dall'isola
        this.WEIGHT_TO_STAIRS = 2;
        this.WEIGHT_STAIRS = 2;
        // Pesi in METRI: attivi solo se TUTTI i negozi del centro hanno coordinate x/y
        // (metri, ingresso del negozio, dalla mappa ufficiale). Altrimenti restano i pesi
        // astratti qui sopra (es. GranRoma). Con i metri la larghezza dei negozi è già
        // nella distanza reale tra gli ingressi: il campo `width` non serve più al grafo.
        this.isMetric = shops.length > 0 && shops.every(s => typeof s.x === 'number' && typeof s.y === 'number');
        // Costi di SCELTA del percorso (non metri camminati: esclusi da result.meters)
        this.METERS_CROSS_PENALTY = 5;  // per ogni cambio di zona: evita lo zig-zag anello↔isola
        this.METERS_STAIRS_RIDE = 40;   // scala mobile: con 40 nessun percorso sullo stesso piano
                                        // scende e risale per accorciare (con 20 erano ~300)
        // Deviazioni (detours) per coppia di id, in entrambe le direzioni
        this.detourMeters = new Map();
        this.detours.forEach(({ a, b, meters }) => {
            this.detourMeters.set(a + '|' + b, meters);
            this.detourMeters.set(b + '|' + a, meters);
        });
        this.stairsNodeFloor = new Map();   // nodo scala -> piano (riempita da buildGraph)
        this.graph = this.buildGraph();
    }

    // Nodo virtuale di una scala mobile a un piano: `stairs_<id scala>_p<piano>`.
    // _pathToSteps e validate_graph riconoscono le scale dal prefisso `stairs_`.
    stairsNodeId(stairsId, floor) {
        return `stairs_${stairsId}_p${floor}`;
    }

    buildGraph() {
        const graph = {};

        // Inizializza tutti i negozi
        this.shops.forEach(shop => {
            graph[shop.id] = {};
        });

        // Helper per aggiungere connessioni bidirezionali
        const addConnection = (id1, id2, weight) => {
            if (!graph[id1]) graph[id1] = {};
            if (!graph[id2]) graph[id2] = {};

            const currentWeight = graph[id1][id2] || Infinity;
            if (weight < currentWeight) {
                graph[id1][id2] = weight;
                graph[id2][id1] = weight;
            }
        };

        // 1. ANELLI - Connessioni negozi consecutivi
        const groupedByZone = {};
        this.shops.forEach(shop => {
            const key = `${shop.floor}_${shop.zone}`;
            if (!groupedByZone[key]) groupedByZone[key] = [];
            groupedByZone[key].push(shop);
        });

        Object.values(groupedByZone).forEach(shopsInZone => {
            const sorted = shopsInZone.sort((a, b) => a.position - b.position);
            // Determina il peso: isole hanno peso maggiore per scoraggiare attraversamento
            const isIsland = sorted[0].zone.includes('ISLAND');
            const weight = isIsland ? this.WEIGHT_ISLAND_RING : this.WEIGHT_SAME_RING;
            // Negozi "larghi" (width > 1, es. il fronte Conad = 17 vetrine): ogni estremo
            // contribuisce all'arco con metà della propria larghezza, così costeggiarli
            // costa il loro prezzo fisico vero e Dijkstra preferisce i percorsi con
            // landmark visibili (i negozi dell'isola parallela).
            const pairWeight = (a, b) => this.isMetric
                ? this.walkMeters(a, b)
                : weight * (((a.width || 1) + (b.width || 1)) / 2);

            // Le mini-isole NON devono essere collegate tra loro in sequenza
            const isMiniIsland = sorted[0].zone === 'ISLAND_MINI';
            if (!isMiniIsland) {
                for (let i = 0; i < sorted.length - 1; i++) {
                    addConnection(sorted[i].id, sorted[i + 1].id, pairWeight(sorted[i], sorted[i + 1]));
                }
                // Chiudi l'anello
                if (sorted.length > 2) {
                    addConnection(sorted[0].id, sorted[sorted.length - 1].id, pairWeight(sorted[0], sorted[sorted.length - 1]));
                }
            }
        });

        // 2. COLLEGAMENTI (links): coppie di negozi senza verso, per id, fisicamente di fronte
        // (isola↔anello, isola↔isola attraverso il corridoio, scorciatoie anello↔anello).
        // Un id inesistente o due piani diversi: il collegamento si salta senza rompere il
        // calcolo (lo segnala validate_graph.js).
        this.links.forEach(({ a: idA, b: idB }) => {
            const a = this.shopById.get(idA);
            const b = this.shopById.get(idB);
            if (!a || !b || a === b || a.floor !== b.floor) return;
            // Il nodo di un negozio "largo" (es. Conad) rappresenta il CENTRO del suo
            // fronte: ogni arco che lo tocca sconta ~width/2 vetrine di camminata per
            // raggiungerlo, come già fanno gli archi d'anello (semisomma delle width).
            // Con meno (es. width/4) il nodo fa da scorciatoia: sia teletrasporto tra
            // le isole, sia zigzag anello→isola→Conad più economico del tratto diretto.
            if (this.isMetric) {
                const penalty = a.zone !== b.zone ? this.METERS_CROSS_PENALTY : 0;
                addConnection(a.id, b.id, this.walkMeters(a, b) + penalty);
                return;
            }
            const widthPenalty = (((a.width || 1) - 1) + ((b.width || 1) - 1)) / 2 * this.WEIGHT_SAME_RING;
            addConnection(a.id, b.id, this.WEIGHT_CROSS_ISLAND + widthPenalty);
        });

        // 3. SCALE MOBILI: un nodo per ogni piano dichiarato di ogni scala, collegato ai
        // negozi in `near` (solo quelli di quel piano). Gli archi verticali uniscono i piani
        // dichiarati della stessa scala, in ordine, a coppie consecutive.
        const ride = this.isMetric ? this.METERS_STAIRS_RIDE : this.WEIGHT_STAIRS;
        this.stairs.forEach(group => {
            const floorsData = group.floors || {};
            const floors = Object.keys(floorsData).map(Number).sort((x, y) => x - y);
            floors.forEach(floor => {
                const node = this.stairsNodeId(group.id, floor);
                if (!graph[node]) graph[node] = {};
                this.stairsNodeFloor.set(node, floor);
                (floorsData[floor].near || []).forEach(id => {
                    const shop = this.shopById.get(id);
                    if (shop && shop.floor === floor) addConnection(node, shop.id, this.stairsWeight(floorsData[floor], shop));
                });
            });
            for (let i = 1; i < floors.length; i++) {
                addConnection(this.stairsNodeId(group.id, floors[i - 1]), this.stairsNodeId(group.id, floors[i]), ride);
            }
        });

        return graph;
    }

    // --- Pesi in metri (solo centri con coordinate x/y su tutti i negozi) ---

    // Metri a piedi tra gli ingressi di due negozi: linea d'aria, salvo le coppie in
    // `detours` dove un muro/angolo/fine isola allunga il cammino reale.
    walkMeters(a, b) {
        const detour = this.detourMeters.get(a.id + '|' + b.id);
        return detour !== undefined ? detour : Math.hypot(a.x - b.x, a.y - b.y);
    }

    // Metri da un negozio all'arrivo più vicino di quella scala a quel piano (`landings`).
    // Senza coordinate (o arrivi non definiti) torna il peso astratto storico.
    stairsWeight(floorData, shop) {
        const landings = this.isMetric ? floorData.landings : null;
        if (!landings || !landings.length) return this.WEIGHT_TO_STAIRS;
        return Math.min(...landings.map(([x, y]) => Math.hypot(shop.x - x, shop.y - y)));
    }

    dijkstra(startId, endId, graph) {
        const distances = {};
        const previous = {};
        const queue = new PriorityQueue();
        const visited = new Set();

        // Inizializza distanze
        Object.keys(graph).forEach(id => {
            distances[id] = Infinity;
        });
        distances[startId] = 0;
        queue.enqueue(startId, 0);

        while (!queue.isEmpty()) {
            const { element: currentId, priority: currentDist } = queue.dequeue();

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            if (currentId === endId) {
                return this.reconstructPath(previous, endId);
            }

            const neighbors = graph[currentId] || {};
            Object.entries(neighbors).forEach(([neighborId, weight]) => {
                const newDist = currentDist + weight;
                if (newDist < distances[neighborId]) {
                    distances[neighborId] = newDist;
                    previous[neighborId] = currentId;
                    queue.enqueue(neighborId, newDist);
                }
            });
        }

        return null;
    }

    reconstructPath(previous, endId) {
        const path = [];
        let current = endId;

        while (current !== undefined) {
            path.unshift(current);
            current = previous[current];
        }

        return path;
    }

    findShortestPath(startShopName, endShopName) {
        const startShop = this.shops.find(s =>
            s.name.toLowerCase() === startShopName.toLowerCase()
        );
        const endShop = this.shops.find(s =>
            s.name.toLowerCase() === endShopName.toLowerCase()
        );

        if (!startShop) {
            return { error: `Negozio di partenza non trovato: ${startShopName}` };
        }
        if (!endShop) {
            return { error: `Negozio di destinazione non trovato: ${endShopName}` };
        }

        return this._computeRoute(startShop, endShop);
    }

    _pathToSteps(path) {
        const steps = [];

        for (let i = 0; i < path.length; i++) {
            const id = path[i];

            if (!id.startsWith('stairs_')) {
                const shop = this.shopById.get(id);
                if (shop) steps.push({ type: 'shop', shop });
                continue;
            }

            // Tutti i nodi scala consecutivi sono un solo tratto in scala mobile, anche se
            // attraversa più piani (es. 0 → 2 passando dal nodo del piano 1): una istruzione.
            let j = i;
            while (j + 1 < path.length && path[j + 1].startsWith('stairs_')) j++;
            const prevShop = this.shopById.get(path[i - 1]) || null;
            const nextShop = this.shopById.get(path[j + 1]) || null;
            const fromFloor = this.stairsNodeFloor.get(path[i]);
            const toFloor = this.stairsNodeFloor.get(path[j]);
            i = j;

            // Stair node usato come shortcut sullo stesso piano: nessuna istruzione
            if (prevShop && nextShop && prevShop.floor === nextShop.floor) continue;

            const isGoingUp = toFloor > fromFloor;
            // Niente lato (DESTRA/SINISTRA): l'utente non sa quali siano "le scale di destra".
            const instruction = isGoingUp
                ? `Sali con le Scale Mobili verso il Piano ${toFloor}`
                : `Scendi con le Scale Mobili verso il Piano ${toFloor}`;
            steps.push({ type: 'stair', instruction, isGoingUp, floors: Math.abs(toFloor - fromFloor) });
        }

        return steps;
    }

    // Variante per usare direttamente gli ID (utile per calcoli multi-leg)
    findShortestPathById(startId, endId) {
        const startShop = this.shopById.get(startId);
        const endShop = this.shopById.get(endId);

        if (!startShop) {
            return { error: `Negozio di partenza non trovato: ${startId}` };
        }
        if (!endShop) {
            return { error: `Negozio di destinazione non trovato: ${endId}` };
        }

        return this._computeRoute(startShop, endShop);
    }

    _computeRoute(startShop, endShop) {
        if (startShop.id === endShop.id) {
            return { error: 'Sei già alla destinazione!' };
        }

        const path = this.dijkstra(startShop.id, endShop.id, this.graph);

        if (!path) {
            return { error: 'Nessun percorso trovato tra i due negozi' };
        }

        const steps = this._pathToSteps(path);
        // cost = costo sul grafo (metri + penalità, o unità astratte): per bagno più
        // vicino e ordine tappe. meters = solo metri camminati (senza penalità né corsa
        // delle scale): per la stima del tempo. null se il centro non ha coordinate.
        let cost = 0, walked = 0;
        for (let i = 1; i < path.length; i++) {
            const w = this.graph[path[i - 1]][path[i]];
            cost += w;
            const a = this.shopById.get(path[i - 1]), b = this.shopById.get(path[i]);
            if (!a && !b) continue;                       // corsa scala mobile
            walked += (a && b && a.zone !== b.zone) ? w - this.METERS_CROSS_PENALTY : w;
        }

        return {
            success: true,
            startShop,
            endShop,
            steps,
            stepsCount: steps.length - 1,
            cost,
            meters: this.isMetric ? Math.round(walked) : null
        };
    }
}

// Priority Queue: min-heap binario (enqueue/dequeue O(log n) invece dello
// splice O(n) della vecchia implementazione a lista ordinata).
class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(element, priority) {
        this.items.push({ element, priority });
        let i = this.items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.items[i].priority >= this.items[parent].priority) break;
            [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
            i = parent;
        }
    }

    dequeue() {
        const top = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0) {
            this.items[0] = last;
            let i = 0;
            while (true) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
                if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
                if (smallest === i) break;
                [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
                i = smallest;
            }
        }
        return top;
    }

    isEmpty() {
        return this.items.length === 0;
    }
}
