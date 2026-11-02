// Copyright (c) 2026 Trovalo. All rights reserved. Unauthorized use prohibited.
// Algoritmo di navigazione con Dijkstra
class NavigationService {
    // mallId esplicito ('porta_di_roma' | 'granroma'); se omesso si ricade sulla
    // vecchia detection per prefisso ID, mantenuta per retrocompatibilità (test/script).
    constructor(shops, mallId = null) {
        this.shops = shops;
        this.mallId = mallId || this.detectMallId();
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
        this.graph = this.buildGraph();
    }

    // Fallback storico: riconosce il centro dal prefisso dell'ID del primo negozio.
    // Fragile con mall futuri dal prefisso simile: preferire sempre il mallId esplicito.
    detectMallId() {
        const firstShopId = this.shops[0]?.id || '';
        if (firstShopId.startsWith('gr_')) return 'granroma';
        if (firstShopId.startsWith('p0_') || firstShopId.startsWith('p1_')) return 'porta_di_roma';
        return null;
    }

    buildGraph() {
        const graph = {};

        // Inizializza tutti i negozi
        this.shops.forEach(shop => {
            graph[shop.id] = {};
        });

        // Inizializza nodi virtuali scale
        graph['stairs_west_p0'] = {};
        graph['stairs_west_p1'] = {};
        graph['stairs_east_p0'] = {};
        graph['stairs_east_p1'] = {};
        // I nodi 'stairs_north_p0/p1' (solo Porta di Roma) sono creati lazy da addConnection

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

        // 2. ISOLE - Attraversamenti verso anello esterno
        const islandConnections = this.getIslandConnections();
        islandConnections.forEach(({ islandShop, outerShops }) => {
            // Cerca il negozio isola solo tra i negozi correnti
            const island = this.shops.find(s => s.name === islandShop);
            // Se il negozio isola non esiste in questo centro, salta questa connessione
            if (!island) return;
            
            outerShops.forEach(outerName => {
                // Cerca il negozio esterno solo tra i negozi correnti dello stesso piano
                const outer = this.shops.find(s => s.name === outerName && s.floor === island.floor);
                // Connetti solo se entrambi i negozi esistono in questo centro
                if (outer) {
                    // Il nodo di un negozio "largo" (es. Conad) rappresenta il CENTRO del suo
                    // fronte: ogni arco che lo tocca sconta ~width/2 vetrine di camminata per
                    // raggiungerlo, come già fanno gli archi d'anello (semisomma delle width).
                    // Con meno (es. width/4) il nodo fa da scorciatoia: sia teletrasporto tra
                    // le isole, sia zigzag anello→isola→Conad più economico del tratto diretto.
                    if (this.isMetric) {
                        const penalty = island.zone !== outer.zone ? this.METERS_CROSS_PENALTY : 0;
                        addConnection(island.id, outer.id, this.walkMeters(island, outer) + penalty);
                        return;
                    }
                    const widthPenalty = (((island.width || 1) - 1) + ((outer.width || 1) - 1)) / 2 * this.WEIGHT_SAME_RING;
                    addConnection(island.id, outer.id, this.WEIGHT_CROSS_ISLAND + widthPenalty);
                }
            });
        });

        // 3. SCALE MOBILI
        // Il centro determina quali negozi sono adiacenti a ciascuna scala
        if (this.mallId === 'granroma') {
            // GranRoma - Scale Mobili
            // Scala SX Piano 0 (di fronte a DENTALPRO, BLUESPIRIT 2, LA CASINA DEL CAFFE)
            const grScalaSxP0 = ['Dentalpro', 'Bluespirit Ingresso', 'La Casina Del Caffe'];
            grScalaSxP0.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 0);
                if (shop) addConnection('stairs_west_p0', shop.id, this.stairsWeight('stairs_west_p0', shop));
            });

            // Scala SX Piano 1 (di fronte a BURGER KING, I BACCANALI)
            const grScalaSxP1 = ['Burger King', 'I Baccanali'];
            grScalaSxP1.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 1);
                if (shop) addConnection('stairs_west_p1', shop.id, this.stairsWeight('stairs_west_p1', shop));
            });

            // Scala DX Piano 0 (di fronte a TRAMAS)
            const grScalaDxP0 = ['Tramas'];
            grScalaDxP0.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 0);
                if (shop) addConnection('stairs_east_p0', shop.id, this.stairsWeight('stairs_east_p0', shop));
            });

            // Scala DX Piano 1 (di fronte a ZARA, DAN JHON)
            const grScalaDxP1 = ['Zara Piano 1', 'Dan Jhon'];
            grScalaDxP1.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 1);
                if (shop) addConnection('stairs_east_p1', shop.id, this.stairsWeight('stairs_east_p1', shop));
            });
        } else {
            // Porta di Roma - Scale Mobili
            // Scala OVEST Piano 0
            const scalaOvestP0Neighbors = ['Pull&Bear', 'MiRaggi', 'Nyx Professional Makeup', 'Liu-Jo'];
            scalaOvestP0Neighbors.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 0);
                if (shop) addConnection('stairs_west_p0', shop.id, this.stairsWeight('stairs_west_p0', shop));
            });

            // Scala OVEST Piano 1
            const scalaOvestP1Neighbors = ["McDonald's", 'Foot Locker', 'Jack & Jones', 'Dispensa Emilia'];
            scalaOvestP1Neighbors.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 1);
                if (shop) addConnection('stairs_west_p1', shop.id, this.stairsWeight('stairs_west_p1', shop));
            });

            // Scala EST Piano 0
            const scalaEstP0Neighbors = ['Talco', 'Jean Louis David', 'Kasanova'];
            scalaEstP0Neighbors.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 0);
                if (shop) addConnection('stairs_east_p0', shop.id, this.stairsWeight('stairs_east_p0', shop));
            });

            // Scala EST Piano 1
            const scalaEstP1Neighbors = ['Timberland', 'Oltre', 'Melluso'];
            scalaEstP1Neighbors.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 1);
                if (shop) addConnection('stairs_east_p1', shop.id, this.stairsWeight('stairs_east_p1', shop));
            });

            // Scala NORD Piano 0 (di fronte a Yamamay e Yamamay uomo)
            const scalaNordP0Neighbors = ['Yamamay', 'Yamamay uomo'];
            scalaNordP0Neighbors.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 0);
                if (shop) addConnection('stairs_north_p0', shop.id, this.stairsWeight('stairs_north_p0', shop));
            });

            // Scala NORD Piano 1 (di fronte a Desigual)
            const scalaNordP1Neighbors = ['Desigual'];
            scalaNordP1Neighbors.forEach(name => {
                const shop = this.shops.find(s => s.name === name && s.floor === 1);
                if (shop) addConnection('stairs_north_p1', shop.id, this.stairsWeight('stairs_north_p1', shop));
            });

            // Connessione verticale scala NORD (solo Porta di Roma)
            addConnection('stairs_north_p0', 'stairs_north_p1', this.isMetric ? this.METERS_STAIRS_RIDE : this.WEIGHT_STAIRS);
        }

        // Connessioni verticali scale (uguali per tutti i mall)
        addConnection('stairs_west_p0', 'stairs_west_p1', this.isMetric ? this.METERS_STAIRS_RIDE : this.WEIGHT_STAIRS);
        addConnection('stairs_east_p0', 'stairs_east_p1', this.isMetric ? this.METERS_STAIRS_RIDE : this.WEIGHT_STAIRS);

        return graph;
    }

    // --- Pesi in metri (solo centri con coordinate x/y su tutti i negozi) ---

    // Metri a piedi tra gli ingressi di due negozi: linea d'aria, salvo le coppie
    // in getWalkDetours() dove un muro/angolo/fine isola allunga il cammino reale.
    walkMeters(a, b) {
        if (!this._detours) {
            this._detours = new Map();
            this.getWalkDetours().forEach(({ a: na, b: nb, meters }) => {
                this._detours.set(na + '|' + nb, meters);
                this._detours.set(nb + '|' + na, meters);
            });
        }
        const detour = this._detours.get(a.name + '|' + b.name);
        return detour !== undefined ? detour : Math.hypot(a.x - b.x, a.y - b.y);
    }

    // Metri da un negozio all'arrivo più vicino di quella scala mobile.
    // Senza coordinate (o arrivi non definiti) torna il peso astratto storico.
    stairsWeight(stairsId, shop) {
        const landings = this.isMetric ? this.getStairsLandings()[stairsId] : null;
        if (!landings || !landings.length) return this.WEIGHT_TO_STAIRS;
        return Math.min(...landings.map(([x, y]) => Math.hypot(shop.x - x, shop.y - y)));
    }

    // Coppie collegate dove il cammino reale supera la linea d'aria di oltre 5 m.
    // Ricavate dalla rete pedonale della mappa ufficiale (Mappedin, 2026-11-02).
    // Accoppiate per NOME esatto come getIslandConnections(): se rinomini un negozio
    // in data.js aggiorna anche qui (validate_graph.js segnala i nomi irrisolti).
    getWalkDetours() {
        if (this.mallId !== 'porta_di_roma') return [];
        return [
            { a: "MAC", b: "MiRaggi", meters: 32 },
            { a: "MAC", b: "Piquadro", meters: 27 },
            { a: "Pull&Bear", b: "Liu-Jo", meters: 33 },
            { a: "Pull&Bear", b: "Motivi", meters: 39 },
            { a: "AppleStore", b: "Clayton", meters: 53 },
            { a: "AppleStore", b: "Bata", meters: 46 },
            { a: "Alcott", b: "Bershka", meters: 22 },
            { a: "Bagno Sud P0", b: "Starbucks", meters: 28 },
            { a: "Farinella", b: "Jean Louis David", meters: 37 },
            { a: "È qui Parafarmacia", b: "Kasanova", meters: 43 },
            { a: "Chic Accent Samsonite Group", b: "Medi Market", meters: 58 },
            { a: "1A Clean Lavasecco", b: "Stroili piano 0", meters: 51 },
            { a: "Bialetti", b: "Heikos", meters: 36 },
            { a: "Flying Tiger", b: "Raggi", meters: 25 },
            { a: "Levi's", b: "Bagno Nord P0", meters: 55 },
            { a: "Bagno Nord P0", b: "Pop Mart", meters: 52 },
            { a: "Decathlon", b: "Franck Provost", meters: 25 },
            { a: "Piquadro", b: "GIOVANNI RASPINI", meters: 27 },
            { a: "Nyx Professional Makeup", b: "Liu-Jo", meters: 18 },
            { a: "Okaidi", b: "Vicolo", meters: 14 },
            { a: "Vicolo", b: "Bottega Verde", meters: 30 },
            { a: "Yves Rocher", b: "Calzedonia", meters: 22 },
            { a: "Nuvolari", b: "Yamamay uomo", meters: 29 },
            { a: "Nuvolari", b: "illy Caffè", meters: 25 },
            { a: "illy Caffè", b: "O Mai", meters: 25 },
            { a: "Nashi", b: "Pandora", meters: 28 },
            { a: "Raggi", b: "Machapokè", meters: 43 },
            { a: "Talco", b: "Douglas Est", meters: 18 },
            { a: "Marlù", b: "Primadonna Collection", meters: 25 },
            { a: "Gamelife", b: "Doppelganger piano 0", meters: 16 },
            { a: "D'Amante", b: "IUMAN-Intimissimi Uomo", meters: 25 },
            { a: "Popeyes", b: "Fradiavolo", meters: 32 },
            { a: "Fradiavolo", b: "Poke House", meters: 22 },
            { a: "Poke House", b: "Guess Accessories", meters: 30 },
            { a: "Toast House", b: "Nike", meters: 40 },
            { a: "Menodiciotto", b: "New Balance", meters: 58 },
            { a: "McDonald's", b: "Foot Locker", meters: 41 },
            { a: "Dispensa Emilia", b: "Flunch", meters: 19 },
            { a: "Flunch", b: "Wiener Haus", meters: 33 },
            { a: "Wiener Haus", b: "Hollywood Game Planet", meters: 23 },
            { a: "Bagno Sud P1", b: "Alice Pizza Point", meters: 25 },
            { a: "Chicco", b: "Tommy Hilfiger", meters: 20 },
            { a: "Alviero Martini 1A Classe", b: "Calvin Klein Jeans", meters: 37 },
            { a: "Fiorella Rubino", b: "The North Face", meters: 54 },
            { a: "Two Way", b: "Geox", meters: 50 },
            { a: "Oltre", b: "Toys con te", meters: 22 },
            { a: "Oltre", b: "Timberland", meters: 29 },
            { a: "Toys con te", b: "Gioielli di Valenza", meters: 22 },
            { a: "Caffè Napoli", b: "Old Wild West", meters: 12 },
            { a: "Guess Accessories", b: "Braccialini", meters: 39 },
            { a: "Braccialini", b: "Solaris", meters: 16 },
            { a: "Jack & Jones", b: "La Piadineria", meters: 20 },
            { a: "La Piadineria", b: "Grom", meters: 35 },
            { a: "GrandVision by Optissimo", b: "Funside", meters: 16 },
            { a: "Caporiccio", b: "Equivalenza", meters: 22 },
            { a: "Cotton&Silk", b: "Harmont & Blaine", meters: 8 },
            { a: "Melluso", b: "Gioielli di Valenza", meters: 36 },
            { a: "Pennyblack", b: "Victoria's Secret", meters: 26 },
            { a: "Stradivarius", b: "Coccinelle", meters: 27 },
        ];
    }

    // Arrivi delle scale mobili (metri, stesso sistema di x/y dei negozi).
    // Le scale sono "a forbice": ogni gruppo ha due punti di arrivo per piano.
    getStairsLandings() {
        if (this.mallId !== 'porta_di_roma') return {};
        return {
            stairs_west_p0: [[57.8, 148.5], [54, 142.4], [85.8, 128.4], [84.4, 126.4]],
            stairs_west_p1: [[86.5, 130.7], [82.7, 124.6], [56.6, 146.5], [55, 143.9]],
            stairs_east_p0: [[14.6, 16.2], [10.5, 9.5], [-14.7, 30.8], [-15.6, 29.2]],
            stairs_east_p1: [[-13.1, 33.3], [-17.2, 26.7], [12, 14.2], [10.7, 12.2]],
            stairs_north_p0: [[70.2, 52.5], [68.6, 53.4], [71.2, 64.3], [72.6, 64.4]],
            stairs_north_p1: [[62.8, 40.7], [61.3, 41.7], [73.2, 50.3], [74.6, 50.4]],
        };
    }

    getIslandConnections() {
        if (this.mallId === 'granroma') {
            return this.getGranRomaConnections();
        }
        if (this.mallId === 'porta_di_roma') {
            return this.getPortaDiRomaConnections();
        }

        console.warn('⚠️ Centro commerciale non riconosciuto');
        return [];
    }

    getPortaDiRomaConnections() {
        // Connessioni isola-anello per Porta di Roma
        return [
            // Piano 0 - Isola SX
            { islandShop: 'Piquadro', outerShops: ['Tezenis', 'MAC', "Levi's"] },
            { islandShop: 'GIOVANNI RASPINI', outerShops: ['MAC', 'MiRaggi'] },
            { islandShop: 'Nyx Professional Makeup', outerShops: ['MiRaggi'] },
            { islandShop: 'Liu-Jo', outerShops: ['Pull&Bear'] },
            { islandShop: 'Motivi', outerShops: ['Pull&Bear'] },
            { islandShop: 'Clayton', outerShops: ['AppleStore'] },
            { islandShop: 'Bata', outerShops: ['AppleStore'] },
            { islandShop: 'Nuna Lie', outerShops: ['Alcott'] },
            { islandShop: 'Okaidi', outerShops: ['Alcott', 'Bershka'] },
            { islandShop: 'Vicolo', outerShops: ['Bershka'] },
            { islandShop: 'Bottega Verde', outerShops: ['JD', 'Starbucks'] },
            { islandShop: 'Wycon', outerShops: ['Burger King'] },
            { islandShop: 'Goldenpoint', outerShops: ['Burger King'] },
            { islandShop: 'Thun', outerShops: ['Burger King', 'Conad'] },
            { islandShop: 'La Casa de las Carcasas', outerShops: ['Conad'] },
            { islandShop: 'Centri Unico', outerShops: ['Conad'] },
            { islandShop: 'Via Condotti', outerShops: ['Conad'] },
            { islandShop: 'Solo Tempo', outerShops: ['Conad'] },
            { islandShop: 'Windtre', outerShops: ['Conad'] },
            { islandShop: '7 Camicie', outerShops: ['Conad'] },
            { islandShop: 'Yves Rocher', outerShops: ['Conad', "D'Amante"] },
            { islandShop: 'Calzedonia', outerShops: ['IUMAN-Intimissimi Uomo'] },
            { islandShop: 'Intimissimi', outerShops: ['Lush'] },
            { islandShop: 'KIKO Milano', outerShops: ['GrandVision by Avanzi'] },
            { islandShop: 'Douglas Ovest', outerShops: ['Miriade'] },
            { islandShop: 'Sandro Ferrone', outerShops: ['Carpisa'] },
            { islandShop: 'Zuiki', outerShops: ['Artigli'] },
            { islandShop: 'Nuvolari', outerShops: ['O Mai'] },
            { islandShop: 'Yamamay uomo', outerShops: ['illy Caffè', 'Dr. Martens', 'United Colors of Benetton'] },
            { islandShop: 'Yamamay', outerShops: ['Dr. Martens'] },
            { islandShop: 'Original Marines', outerShops: ['H&M'] },
            { islandShop: 'Parfois', outerShops: ['H&M'] },
            { islandShop: 'Lovable', outerShops: ['H&M'] },
            { islandShop: 'Bluespirit', outerShops: ['H&M', 'Just Design'] },
            { islandShop: 'Fielmann', outerShops: ['Lego'] },
            { islandShop: 'Vestopazzo', outerShops: ['Lego', 'Tezenis'] },

            // Piano 0 - Isola DX
            { islandShop: 'illy Caffè', outerShops: ['Yamamay uomo', 'Rituals', 'Nuvolari'] },
            { islandShop: 'Bijou Brigitte', outerShops: ['Rituals'] },
            { islandShop: 'Nespresso', outerShops: ['Barca'] },
            { islandShop: 'Swatch', outerShops: ['Snipes'] },
            { islandShop: 'Raggi', outerShops: ['Normal', 'Mediaworld', 'Flying Tiger'] },
            { islandShop: 'Machapokè', outerShops: ['Flying Tiger', 'Pasticceria Bellavia'] },
            { islandShop: 'Heikos', outerShops: ['Bialetti'] },
            { islandShop: 'Stroili piano 0', outerShops: ['1A Clean Lavasecco'] },
            { islandShop: 'Medi Market', outerShops: ['Chic Accent Samsonite Group'] },
            { islandShop: 'Kasanova', outerShops: ['È qui Parafarmacia'] },
            { islandShop: 'Talco', outerShops: ['Jean Louis David'] },
            { islandShop: 'Douglas Est', outerShops: ['Jean Louis David'] },
            { islandShop: 'La Casa del Tabacco', outerShops: ['Jean Louis David', 'Farinella'] },
            { islandShop: 'Marlù', outerShops: ['Farinella'] },
            { islandShop: 'Primadonna Collection', outerShops: ['Conad', 'La Feltrinelli'] },
            { islandShop: 'Vodafone', outerShops: ['Conad'] },
            { islandShop: 'Gamelife', outerShops: ['Conad'] },
            { islandShop: 'Doppelganger piano 0', outerShops: ['Conad'] },
            { islandShop: 'TIM Gruppo Distribuzione Spa (piano 0)', outerShops: ['Conad'] },
            { islandShop: 'Iliad', outerShops: ['Conad'] },
            { islandShop: 'Capello point', outerShops: ['Conad'] },
            { islandShop: "D'Amante", outerShops: ['Conad', 'Yves Rocher'] },
            { islandShop: 'IUMAN-Intimissimi Uomo', outerShops: ['Calzedonia'] },
            { islandShop: 'Lush', outerShops: ['Intimissimi'] },
            { islandShop: 'GrandVision by Avanzi', outerShops: ['KIKO Milano'] },
            { islandShop: 'Miriade', outerShops: ['Douglas Ovest'] },
            { islandShop: 'Carpisa', outerShops: ['Sandro Ferrone'] },
            { islandShop: 'Artigli', outerShops: ['Zuiki'] },
            { islandShop: 'O Mai', outerShops: ['Nuvolari'] },

            // Piano 0 - Scorciatoie anello↔anello (shortcut: true = due negozi OUTER, voluto).
            // Verificate sulla rete pedonale ufficiale (2026-11-02). I bagni sono in corridoi
            // laterali: senza questi archi l'anello obbligava a passare dal bagno tra
            // JD↔Starbucks e Levi's↔Pop Mart.
            { islandShop: 'JD', outerShops: ['Starbucks'], shortcut: true },
            { islandShop: "Levi's", outerShops: ['Pop Mart'], shortcut: true },
            { islandShop: 'Franck Provost', outerShops: ['Salmoiraghi & Viganò'], shortcut: true },

            // Piano 1 - Isola Center
            { islandShop: 'Guess Accessories', outerShops: ['Michael Kors', 'Poke House'] },
            { islandShop: 'Braccialini', outerShops: ['Kebhouze'] },
            { islandShop: 'Solaris', outerShops: ['Kebhouze'] },
            { islandShop: 'Nike', outerShops: ['Milos Greek Food', 'Toast House'] },
            { islandShop: 'New Balance', outerShops: ['Menodiciotto'] },
            { islandShop: 'Foot Locker', outerShops: ["McDonald's"] },
            { islandShop: 'Jack & Jones', outerShops: ['Dispensa Emilia'] },
            { islandShop: 'La Piadineria', outerShops: ['Flunch'] },
            { islandShop: 'Grom', outerShops: ['Flunch', 'Foodie', 'Alice Pizza Point'] },
            // Scorciatoia anello↔anello davanti al Bagno Sud P1 (verificata sulla mappa ufficiale)
            { islandShop: 'Alice Pizza Point', outerShops: ['Flunch'], shortcut: true },
            { islandShop: 'Camicissima', outerShops: ['Visionottica'] },
            { islandShop: 'Legami', outerShops: ['Cisalfa Sport'] },
            { islandShop: 'Dyson', outerShops: ['Cisalfa Sport', 'Upim'] },
            { islandShop: 'Primor', outerShops: ['Upim'] },
            { islandShop: 'Stroili', outerShops: ['Upim', 'Ovs'] },
            { islandShop: 'Imperial', outerShops: ['Ovs'] },
            { islandShop: 'GrandVision by Optissimo', outerShops: ['Ovs'] },
            { islandShop: 'Funside', outerShops: ['Ovs'] },
            { islandShop: 'AS Roma', outerShops: ['Unieuro'] },
            { islandShop: 'Sottotono', outerShops: ['Unieuro'] },
            { islandShop: 'Tim piano 1', outerShops: ['Unieuro'] },
            { islandShop: 'Caporiccio', outerShops: ['Unieuro', 'Skechers', 'Prénatal'] },
            { islandShop: 'Equivalenza', outerShops: ['Prénatal', 'Chicco'] },
            { islandShop: 'Panfuwa', outerShops: ['Chicco'] },
            { islandShop: "L'Erbolario", outerShops: ['Chicco'] },
            { islandShop: 'Cotton&Silk', outerShops: ['Chicco'] },
            { islandShop: 'Harmont & Blaine', outerShops: ['Tommy Hilfiger'] },
            { islandShop: 'Calvin Klein Jeans', outerShops: ['Alviero Martini 1A Classe'] },
            { islandShop: 'The North Face', outerShops: ['Fiorella Rubino'] },
            { islandShop: 'Geox', outerShops: ['Two Way'] },
            { islandShop: 'Timberland', outerShops: ['Oltre'] },
            { islandShop: 'Melluso', outerShops: ['Oltre'] },
            { islandShop: 'Gioielli di Valenza', outerShops: ['Toys con te', 'MediaWorld piano 1', 'Zara Home'] },
            { islandShop: 'Dan John', outerShops: ['Oysho'] },
            { islandShop: 'Noikika', outerShops: ['Zara'] },
            { islandShop: 'Pennyblack', outerShops: ['Zara'] },
            { islandShop: "Victoria's Secret", outerShops: ['Zara'] },
            { islandShop: 'Armani Exchange', outerShops: [] },
            { islandShop: 'Stradivarius', outerShops: [] },
            { islandShop: 'Coccinelle', outerShops: ['Pellizzari', 'Luisa Spagnoli'] },
            { islandShop: 'Lacoste', outerShops: ['Pellizzari'] },
            { islandShop: 'Marella', outerShops: ['Pellizzari'] },
            { islandShop: 'Camper', outerShops: ['Guess'] },
            { islandShop: 'David Naman', outerShops: ['Paul Taylor'] },
            { islandShop: 'Doppelganger piano 1', outerShops: ['Mango', 'Paul Taylor'] },
            { islandShop: 'Windtre (piano 1)', outerShops: ['Mango'] }
        ];
    }

    getGranRomaConnections() {
        // Connessioni isola-anello per GranRoma
        return [
            // Piano 0 - Isola Centrale (21 negozi)
            { islandShop: 'Stroili', outerShops: ['Maisons Du Monde', 'Douglas', 'Skechers'] },
            { islandShop: 'Carpisa', outerShops: ["Deco'"] },
            { islandShop: 'Lama Optical', outerShops: ["Deco'"] },
            { islandShop: 'Zuiki', outerShops: ['Cisalfa Sport'] },
            { islandShop: 'Parfois', outerShops: ['Cisalfa Sport'] },
            { islandShop: 'Bluespirit Ingresso', outerShops: ['Kasanova+', 'Cisalfa Sport'] },
            { islandShop: 'Mondovista', outerShops: ['Mayoral'] },
            { islandShop: 'Omai', outerShops: ['Mango'] },
            { islandShop: 'Talco', outerShops: ['Mango'] },
            { islandShop: 'Kamalion', outerShops: ['Nuvolari'] },
            { islandShop: 'Grandvision', outerShops: ['Flying Tiger Copenhagen'] },
            { islandShop: 'Calzedonia', outerShops: ['Zara', 'Jdsports', 'Gelateria Cremilla'] },
            { islandShop: 'Bluespirit', outerShops: ['Zara'] },
            //{ islandShop: 'Satur', outerShops: ['Tramas'] },
            //{ islandShop: 'Bata', outerShops: ['Tramas'] },
            { islandShop: 'Intimissimi', outerShops: ['Ovs', 'Tezenis'] },
            { islandShop: 'Vodafone', outerShops: ['Punt Roma', 'Sorbino'] },
            { islandShop: 'Originalmarines', outerShops: ['Sorbino', 'Primadonna Collection'] },
            { islandShop: 'Medimarket', outerShops: ['Primadonna Collection', 'Yvesrocher'] },
            { islandShop: 'Snipes', outerShops: ['Yvesrocher', 'Cex'] },

            // Piano 1 - Isola Centrale (19 negozi)
            { islandShop: 'Caffè Vergnano 1882', outerShops: ['I Baccanali', 'Burger King', "Hamerica's"] },
            { islandShop: 'Tabaccheria', outerShops: ["Hamerica's", 'Kitikate'] },
            { islandShop: 'Queen Helena', outerShops: ['Kitikate', 'Mister Games'] },
            { islandShop: 'Rinascimento', outerShops: ['Mister Games', 'Estasi Profumerie'] },
            { islandShop: 'Sartoria Italiana', outerShops: ['Odstore'] },
            { islandShop: 'Pink Gioielli', outerShops: ['Jack & Jones'] },
            { islandShop: 'Brend Atelier', outerShops: ['Jack & Jones', 'Stradivarius'] },
            { islandShop: 'Dan Jhon', outerShops: ['Zara Piano 1', 'Stradivarius'] },
            { islandShop: 'Guess', outerShops: ['Muy Mucho'] },
            { islandShop: "D'S Damat", outerShops: ['Pull & Bear', 'Action', 'Bershka'] },
            { islandShop: 'Dly', outerShops: ['Pepco'] },
            { islandShop: 'Dverso', outerShops: ['Live978', 'Pepco'] },
            { islandShop: 'Gioiellivalenza', outerShops: ['Live978'] },
            { islandShop: 'Wind Tre', outerShops: ['Live978'] },
            { islandShop: 'Findomestic', outerShops: ['Mediaworld'] },
            { islandShop: 'Marlù', outerShops: ['Mediaworld'] },
            { islandShop: 'Giunti Al Punto', outerShops: ["Villabebe'"] },
            { islandShop: 'Machapokè', outerShops: ['Billy Tacos'] },
            { islandShop: 'Minipizza 22C M2', outerShops: ['Billy Tacos'] },

            // Piano 1 - Mini Isole (3 negozi speciali)
            { islandShop: 'I Baccanali', outerShops: ['Burger King', 'Billy Tacos', 'La Piadineria','Caffè Vergnano 1882'] },
            { islandShop: 'Capatoast Toasteria', outerShops: ['Billy Tacos', 'Minipizza 22C M2', 'Machapokè'] },
            { islandShop: 'Equivalenza', outerShops: ["D'S Damat", 'Pull & Bear', 'Bershka', 'Action'] }
        ];
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
        let skipNextStair = false;

        for (let i = 0; i < path.length; i++) {
            const id = path[i];

            if (id.startsWith('stairs_')) {
                if (!skipNextStair) {
                    const prevShop = i > 0 && !path[i - 1].startsWith('stairs_')
                        ? this.shopById.get(path[i - 1])
                        : null;

                    let nextShop = null;
                    for (let j = i + 1; j < path.length; j++) {
                        if (!path[j].startsWith('stairs_')) {
                            nextShop = this.shopById.get(path[j]);
                            break;
                        }
                    }

                    // Stair node usato come shortcut sullo stesso piano: nessuna istruzione
                    if (prevShop && nextShop && prevShop.floor === nextShop.floor) {
                        // noop — percorso passa vicino alle scale senza cambio piano
                    } else {
                        const isGoingUp = prevShop?.floor === 0 && nextShop?.floor === 1;
                        // Niente lato (DESTRA/SINISTRA): l'utente non sa quali siano "le scale di destra".
                        const instruction = isGoingUp
                            ? `Sali con le Scale Mobili verso il Piano 1`
                            : `Scendi con le Scale Mobili verso il Piano 0`;

                        steps.push({ type: 'stair', instruction, isGoingUp });
                        skipNextStair = true;
                    }
                } else {
                    skipNextStair = false;
                }
            } else {
                const shop = this.shopById.get(id);
                if (shop) steps.push({ type: 'shop', shop });
            }
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
