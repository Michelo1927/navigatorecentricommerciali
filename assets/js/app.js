// Copyright (c) 2026 Trovalo. All rights reserved. Unauthorized use prohibited.
// App principale — richiede data.js caricato prima (selectedMall, SHOPS_DATA, MALLS_DATA, MALLS_CONFIG)
let navigationService = null;

// Elementi DOM
const mallSelectionSection = document.getElementById('mallSelectionSection');
const mainHeader = document.getElementById('mainHeader');
const searchSection = document.getElementById('searchSection');
const loadingSection = document.getElementById('loadingSection');
const routeSection = document.getElementById('routeSection');
const mallsGrid = document.getElementById('mallsGrid');
const changeMallBtn = document.getElementById('changeMallBtn');

const startShopInput = document.getElementById('startShop');
const endShopInput = document.getElementById('endShop');
const startSuggestions = document.getElementById('startSuggestions');
const endSuggestions = document.getElementById('endSuggestions');
const waypointInput = document.getElementById('waypointInput');
const waypointSuggestions = document.getElementById('waypointSuggestions');
const routeBuilderPreview = document.getElementById('routeBuilderPreview');
const routeBuilderHeader = document.getElementById('routeBuilderHeader');
const calculateBtn = document.getElementById('calculateBtn');
const efficientRouteBtn = document.getElementById('efficientRouteBtn');
const bathroomQuickToggle = document.getElementById('bathroomQuickToggle');
const backBtn = document.getElementById('backBtn');
const startCategoryFilterBtn = document.getElementById('startCategoryFilterBtn');
const startCategoryFilterMenu = document.getElementById('startCategoryFilterMenu');
const endCategoryFilterBtn = document.getElementById('endCategoryFilterBtn');
const endCategoryFilterMenu = document.getElementById('endCategoryFilterMenu');
const waypointCategoryFilterBtn = document.getElementById('waypointCategoryFilterBtn');
const waypointCategoryFilterMenu = document.getElementById('waypointCategoryFilterMenu');

const endShopDefaultPlaceholder = endShopInput ? endShopInput.placeholder : '';
const waypointDefaultPlaceholder = waypointInput ? waypointInput.placeholder : '';

const routeStops = document.getElementById('routeStops');
const routeTime = document.getElementById('routeTime');
const stepsContainer = document.getElementById('stepsContainer');

let selectedStartShop = null;
let selectedEndShop = null;
let waypoints = []; // array of shop objects in order
let efficientRouteEnabled = false;
let bathroomQuickEnabled = false;
// Modalità "Bagno" non distruttiva: destinazione e tappe correnti vengono messe da parte
// all'attivazione e ripristinate alla disattivazione (invece di essere cancellate).
let savedEndShop = null;
let savedWaypoints = [];
let activeStartCategoryFilter = 'Tutto';
let activeEndCategoryFilter = 'Tutto';
let activeWaypointCategoryFilter = 'Tutto';

// L'"Ottimizzazione percorso" riordina le tappe: ha senso solo con almeno 2 tappe intermedie.
function isEfficientRouteAvailable() {
    return waypoints.length >= 2;
}

function updateEfficientRouteButton() {
    if (!efficientRouteBtn) return;
    const available = isEfficientRouteAvailable();
    // Con meno di 2 tappe intermedie non c'è nulla da riordinare: forza lo stato spento
    if (!available && efficientRouteEnabled) {
        efficientRouteEnabled = false;
    }
    // Il chip vive nell'intestazione della lista tappe: compare solo quando è attivabile
    efficientRouteBtn.hidden = !available;
    efficientRouteBtn.classList.toggle('active', efficientRouteEnabled);
    if (typeof efficientRouteBtn.setAttribute === 'function') {
        efficientRouteBtn.setAttribute('aria-pressed', String(efficientRouteEnabled));
    }
}

function mallHasBathrooms() {
    return Array.isArray(SHOPS_DATA) && SHOPS_DATA.some(shop => shop.type === 'Bagni');
}

function updateBathroomFeatureAvailability() {
    if (!bathroomQuickToggle) return;

    const available = mallHasBathrooms();
    bathroomQuickToggle.style.display = available ? '' : 'none';

    // Se il centro non ha bagni, disattiva la modalità eventualmente attiva.
    // Qui NON si ripristina lo stash: apparterrebbe a un altro centro; lo si svuota.
    if (!available && bathroomQuickEnabled) {
        bathroomQuickEnabled = false;
        savedEndShop = null;
        savedWaypoints = [];
        updateBathroomQuickToggle();
    }
}

// Transizione della modalità Bagno: mette da parte (o ripristina) destinazione e tappe
// senza distruggerle. Da usare per ogni cambio di stato "vero" innescato dall'utente.
function setBathroomQuickEnabled(enabled) {
    if (enabled === bathroomQuickEnabled) return;
    if (enabled) {
        // Metti da parte destinazione e tappe correnti, poi liberale
        savedEndShop = selectedEndShop;
        savedWaypoints = waypoints.slice();
        selectedEndShop = null;
        waypoints = [];
    } else {
        // Ripristina ciò che era stato messo da parte
        selectedEndShop = savedEndShop;
        waypoints = savedWaypoints.slice();
        savedEndShop = null;
        savedWaypoints = [];
    }
    bathroomQuickEnabled = enabled;
    updateBathroomQuickToggle();
}

function updateBathroomQuickToggle() {
    if (!bathroomQuickToggle) return;

    bathroomQuickToggle.classList.toggle('active', bathroomQuickEnabled);
    bathroomQuickToggle.setAttribute('aria-pressed', String(bathroomQuickEnabled));

    if (endShopInput) {
        endShopInput.disabled = bathroomQuickEnabled;
        endShopInput.value = bathroomQuickEnabled ? '' : (selectedEndShop ? selectedEndShop.name : '');
        endShopInput.placeholder = bathroomQuickEnabled
            ? 'Bagno più vicino (automatico)'
            : endShopDefaultPlaceholder;
    }

    if (endCategoryFilterBtn) {
        endCategoryFilterBtn.disabled = bathroomQuickEnabled;
        endCategoryFilterBtn.setAttribute('aria-disabled', String(bathroomQuickEnabled));
    }

    if (waypointInput) {
        waypointInput.disabled = bathroomQuickEnabled;
        waypointInput.value = bathroomQuickEnabled ? '' : waypointInput.value;
        waypointInput.placeholder = bathroomQuickEnabled
            ? 'Tappe disabilitate in modalità bagno'
            : waypointDefaultPlaceholder;
    }

    if (waypointCategoryFilterBtn) {
        waypointCategoryFilterBtn.disabled = bathroomQuickEnabled;
        waypointCategoryFilterBtn.setAttribute('aria-disabled', String(bathroomQuickEnabled));
    }

    if (endSuggestions) {
        endSuggestions.classList.remove('show');
    }

    if (waypointSuggestions) {
        waypointSuggestions.classList.remove('show');
    }

    renderRouteBuilderPreview();
    checkCanCalculate();
}

if (efficientRouteBtn) {
    updateEfficientRouteButton();
    efficientRouteBtn.addEventListener('click', (e) => {
        if (e.target.closest('#efficientRouteInfoBtn')) return;
        if (!isEfficientRouteAvailable()) return; // non attivabile senza almeno 2 tappe intermedie
        efficientRouteEnabled = !efficientRouteEnabled;
        updateEfficientRouteButton();
    });
}

if (bathroomQuickToggle) {
    updateBathroomQuickToggle();
    bathroomQuickToggle.addEventListener('click', () => {
        setBathroomQuickEnabled(!bathroomQuickEnabled);
    });
}

// Escape per interpolazioni in innerHTML: i dati oggi sono statici, ma un nome
// negozio con <, " o & romperebbe markup e attributi (XSS latente).
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Gestione autocomplete
function setupAutocomplete(input, suggestionsDiv, onSelect, getCategoryFilter) {
    const buildMatches = (query, showAll) => {
        const activeFilter = typeof getCategoryFilter === 'function' ? getCategoryFilter() : 'Tutto';
        const normalizedQuery = query.trim().toLowerCase();
        const matches = SHOPS_DATA.filter(shop => {
            if (activeFilter !== 'Tutto' && shop.type !== activeFilter) return false;
            if (!normalizedQuery) return true;
            return shop.name.toLowerCase().includes(normalizedQuery);
        }).sort((a, b) => a.name.localeCompare(b.name));

        return showAll ? matches : matches.slice(0, 10);
    };

    const renderSuggestions = (query, showAll) => {
        if (!showAll && query.trim().length < 2) {
            suggestionsDiv.classList.remove('show');
            return;
        }

        const matches = buildMatches(query, showAll);
        if (matches.length === 0) {
            suggestionsDiv.classList.remove('show');
            return;
        }

        suggestionsDiv.innerHTML = matches.map(shop => `
            <div class="suggestion-item" role="option" data-shop-id="${escapeHtml(shop.id)}">
                <div class="suggestion-name">${escapeHtml(shop.name)}</div>
                <div class="suggestion-details">
                    Piano ${shop.floor} • ${getZoneLabel(shop.zone)}
                </div>
            </div>
        `).join('');

        suggestionsDiv.classList.add('show');
        highlightedIndex = -1;

        // Gestione click sui suggerimenti
        suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const shopId = item.dataset.shopId;
                const shop = SHOPS_DATA.find(s => s.id === shopId);
                if (shop) {
                    input.value = shop.name;
                    onSelect(shop);
                    suggestionsDiv.classList.remove('show');
                }
            });
        });
    };

    // Navigazione da tastiera: frecce per scorrere, Invio per selezionare, Esc per chiudere
    let highlightedIndex = -1;

    const updateHighlight = (items) => {
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === highlightedIndex);
            item.setAttribute('aria-selected', String(i === highlightedIndex));
        });
        if (highlightedIndex >= 0 && items[highlightedIndex].scrollIntoView) {
            items[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    };

    input.addEventListener('keydown', (e) => {
        if (!suggestionsDiv.classList.contains('show')) return;
        const items = Array.from(suggestionsDiv.querySelectorAll('.suggestion-item'));
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = (highlightedIndex + 1) % items.length;
            updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = highlightedIndex <= 0 ? items.length - 1 : highlightedIndex - 1;
            updateHighlight(items);
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0 && highlightedIndex < items.length) {
                e.preventDefault();
                items[highlightedIndex].click();
                highlightedIndex = -1;
            }
        } else if (e.key === 'Escape') {
            suggestionsDiv.classList.remove('show');
            highlightedIndex = -1;
        }
    });

    input.addEventListener('input', () => {
        renderSuggestions(input.value, false);
    });

    input.addEventListener('focus', () => {
        if (!input.value.trim()) {
            renderSuggestions('', true);
        }
    });

    // Chiudi suggerimenti quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.classList.remove('show');
        }
    });
}

function getZoneLabel(zone) {
    const labels = {
        'OUTER': 'Anello Esterno',
        'ISLAND_SX': 'Isola Sinistra',
        'ISLAND_DX': 'Isola Destra',
        'ISLAND_CENTER': 'Isola Centrale',
        'ISLAND_MINI': 'Isola'
    };
    return labels[zone] || zone;
}

function handleShopSelection(shop) {
    if (!shop) return;

    // In modalità Bagno destinazione e tappe sono automatiche (e i loro campi
    // disabilitati): dal modale si può impostare solo la partenza.
    if (bathroomQuickEnabled && selectedStartShop) {
        showError('Disattiva "Destinazione rapida: Bagno" per scegliere destinazione o tappe');
        return;
    }

    if (!selectedStartShop) {
        if (selectedEndShop && selectedEndShop.id === shop.id) {
            showError('Questo negozio è già la tua destinazione');
            return;
        }
        if (waypoints.some(w => w.id === shop.id)) {
            showError('Questo negozio è già una tappa');
            return;
        }
        startShopInput.value = shop.name;
        selectedStartShop = shop;
        startShopInput.focus();
        hideError();
    } else if (!selectedEndShop && waypoints.length === 0) {
        if (selectedStartShop.id === shop.id) {
            showError('Questo negozio è già la tua partenza');
            return;
        }
        endShopInput.value = shop.name;
        selectedEndShop = shop;
        hideError();
    } else {
        addWaypoint(shop);
    }

    renderRouteBuilderPreview();
    checkCanCalculate();
}

function getCategoryList() {
    const categories = SHOPS_DATA
        .map(shop => shop.type)
        .filter(Boolean);
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
}

function renderCategoryFilterMenu(button, menu, activeCategory) {
    if (!button || !menu) return;

    const categories = ['Tutto', ...getCategoryList()];
    menu.innerHTML = categories.map(category => {
        const active = category === activeCategory;
        return `
            <div class="filter-option ${active ? 'active' : ''}" role="option" tabindex="0" aria-selected="${active}" data-category="${escapeHtml(category)}">
                <span>${escapeHtml(category)}</span>
                <span class="filter-check">✓</span>
            </div>
        `;
    }).join('');

    menu.querySelectorAll('.filter-option').forEach(option => {
        // Attivabile anche da tastiera (le option sono div, non button)
        option.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                option.click();
            }
        });
        option.addEventListener('click', () => {
            const category = option.dataset.category;
            if (menu === startCategoryFilterMenu) {
                setActiveStartCategoryFilter(category);
                closeCategoryMenu(startCategoryFilterBtn, startCategoryFilterMenu);
            } else if (menu === endCategoryFilterMenu) {
                setActiveEndCategoryFilter(category);
                closeCategoryMenu(endCategoryFilterBtn, endCategoryFilterMenu);
            } else {
                setActiveWaypointCategoryFilter(category);
                closeCategoryMenu(waypointCategoryFilterBtn, waypointCategoryFilterMenu);
            }
        });
    });
}

// Aggiorna solo l'etichetta del bottone filtro: scrivere button.textContent
// distruggerebbe l'icona SVG interna. Il title dà il nome completo quando troncato.
function setFilterButtonLabel(button, category) {
    if (!button) return;
    const label = button.querySelector('.filter-toggle-label');
    if (label) {
        label.textContent = category;
    } else {
        button.textContent = category;
    }
    if (category && category !== 'Tutto') {
        button.title = category;
    } else {
        button.removeAttribute('title');
    }
}

function setActiveStartCategoryFilter(category) {
    activeStartCategoryFilter = category;
    setFilterButtonLabel(startCategoryFilterBtn, category);
    renderCategoryFilterMenu(startCategoryFilterBtn, startCategoryFilterMenu, activeStartCategoryFilter);
}

function setActiveEndCategoryFilter(category) {
    activeEndCategoryFilter = category;
    setFilterButtonLabel(endCategoryFilterBtn, category);
    renderCategoryFilterMenu(endCategoryFilterBtn, endCategoryFilterMenu, activeEndCategoryFilter);
}

function setActiveWaypointCategoryFilter(category) {
    activeWaypointCategoryFilter = category;
    setFilterButtonLabel(waypointCategoryFilterBtn, category);
    renderCategoryFilterMenu(waypointCategoryFilterBtn, waypointCategoryFilterMenu, activeWaypointCategoryFilter);
}

function toggleCategoryMenu(button, menu) {
    if (!menu || !button) return;
    const isOpen = menu.classList.toggle('show');
    button.setAttribute('aria-expanded', String(isOpen));
}

function closeCategoryMenu(button, menu) {
    if (!menu || !button) return;
    menu.classList.remove('show');
    button.setAttribute('aria-expanded', 'false');
}

function refreshCategoryFilters() {
    renderCategoryFilterMenu(startCategoryFilterBtn, startCategoryFilterMenu, activeStartCategoryFilter);
    renderCategoryFilterMenu(endCategoryFilterBtn, endCategoryFilterMenu, activeEndCategoryFilter);
    renderCategoryFilterMenu(waypointCategoryFilterBtn, waypointCategoryFilterMenu, activeWaypointCategoryFilter);
}

// Setup autocomplete per entrambi i campi. La validazione avviene alla selezione:
// senza, un negozio già usato nell'altro ruolo/tappa passerebbe e il calcolo
// fallirebbe con un fuorviante "Sei già alla destinazione!" sul leg x→x.
// Selezione rifiutata → campo e selezione svuotati (niente ripristino del valore
// precedente): l'utente può ri-cliccare subito e scegliere un altro negozio.
function clearStartSelection() {
    startShopInput.value = '';
    selectedStartShop = null;
    renderRouteBuilderPreview();
    checkCanCalculate();
}

function clearEndSelection() {
    endShopInput.value = '';
    selectedEndShop = null;
    renderRouteBuilderPreview();
    checkCanCalculate();
}

setupAutocomplete(startShopInput, startSuggestions, (shop) => {
    if (selectedEndShop && selectedEndShop.id === shop.id) {
        showError('Questo negozio è già la tua destinazione');
        clearStartSelection();
        return;
    }
    if (waypoints.some(w => w.id === shop.id)) {
        showError('Questo negozio è già una tappa');
        clearStartSelection();
        return;
    }
    selectedStartShop = shop;
    hideError();
    renderRouteBuilderPreview();
    checkCanCalculate();
}, () => activeStartCategoryFilter);

setupAutocomplete(endShopInput, endSuggestions, (shop) => {
    if (selectedStartShop && selectedStartShop.id === shop.id) {
        showError('Questo negozio è già la tua partenza');
        clearEndSelection();
        return;
    }
    if (waypoints.some(w => w.id === shop.id)) {
        showError('Questo negozio è già una tappa');
        clearEndSelection();
        return;
    }
    selectedEndShop = shop;
    hideError();
    renderRouteBuilderPreview();
    checkCanCalculate();
}, () => activeEndCategoryFilter);

// Testo modificato a mano = selezione non più affidabile. Senza questo azzeramento
// il negozio resta selezionato "invisibile" (campo svuotato ma ancora partenza/
// destinazione a tutti gli effetti): rifiuta come duplicati negozi che a schermo
// non ci sono più e lascia il calcolo attivo con campo vuoto.
startShopInput.addEventListener('input', () => {
    if (selectedStartShop && startShopInput.value.trim() !== selectedStartShop.name) {
        selectedStartShop = null;
        renderRouteBuilderPreview();
        checkCanCalculate();
    }
});

endShopInput.addEventListener('input', () => {
    if (selectedEndShop && endShopInput.value.trim() !== selectedEndShop.name) {
        selectedEndShop = null;
        renderRouteBuilderPreview();
        checkCanCalculate();
    }
});

// Autocomplete per aggiungere waypoint
if (waypointInput && waypointSuggestions) {
    setupAutocomplete(waypointInput, waypointSuggestions, (shop) => {
        // Aggiungi alla lista di waypoint
        addWaypoint(shop);
        waypointInput.value = '';
        waypointSuggestions.classList.remove('show');
    }, () => activeWaypointCategoryFilter);
}

if (startCategoryFilterBtn && startCategoryFilterMenu) {
    startCategoryFilterBtn.addEventListener('click', () => {
        toggleCategoryMenu(startCategoryFilterBtn, startCategoryFilterMenu);
    });
}

if (endCategoryFilterBtn && endCategoryFilterMenu) {
    endCategoryFilterBtn.addEventListener('click', () => {
        toggleCategoryMenu(endCategoryFilterBtn, endCategoryFilterMenu);
    });
}

if (waypointCategoryFilterBtn && waypointCategoryFilterMenu) {
    waypointCategoryFilterBtn.addEventListener('click', () => {
        toggleCategoryMenu(waypointCategoryFilterBtn, waypointCategoryFilterMenu);
    });
}

document.addEventListener('click', (e) => {
    if (startCategoryFilterBtn && startCategoryFilterMenu) {
        if (!startCategoryFilterBtn.contains(e.target) && !startCategoryFilterMenu.contains(e.target)) {
            closeCategoryMenu(startCategoryFilterBtn, startCategoryFilterMenu);
        }
    }
    if (endCategoryFilterBtn && endCategoryFilterMenu) {
        if (!endCategoryFilterBtn.contains(e.target) && !endCategoryFilterMenu.contains(e.target)) {
            closeCategoryMenu(endCategoryFilterBtn, endCategoryFilterMenu);
        }
    }
    if (waypointCategoryFilterBtn && waypointCategoryFilterMenu) {
        if (!waypointCategoryFilterBtn.contains(e.target) && !waypointCategoryFilterMenu.contains(e.target)) {
            closeCategoryMenu(waypointCategoryFilterBtn, waypointCategoryFilterMenu);
        }
    }
});

function addWaypoint(shop) {
    if (!shop) return;
    if (selectedStartShop && selectedStartShop.id === shop.id) {
        showError('Questo negozio è già la tua partenza');
        return;
    }
    if (selectedEndShop && selectedEndShop.id === shop.id) {
        showError('Questo negozio è già la tua destinazione');
        return;
    }
    // evita duplicati (anche non consecutivi)
    if (waypoints.some(w => w.id === shop.id)) return;
    waypoints.push(shop);
    hideError(); // tappa valida → nascondi eventuale errore
    renderRouteBuilderPreview();
    checkCanCalculate();
}

function removeWaypoint(index) {
    if (index < 0 || index >= waypoints.length) return;
    waypoints.splice(index, 1);
    renderRouteBuilderPreview();
    checkCanCalculate();
}

// Riordino manuale delle tappe (frecce su/giù). direction: -1 = su, +1 = giù.
function moveWaypoint(index, direction) {
    const target = index + direction;
    if (index < 0 || index >= waypoints.length) return;
    if (target < 0 || target >= waypoints.length) return;
    [waypoints[index], waypoints[target]] = [waypoints[target], waypoints[index]];
    // Un riordino manuale esprime un ordine esplicito: l'ottimizzazione automatica
    // lo sovrascriverebbe al calcolo, quindi la disattiviamo.
    if (efficientRouteEnabled) {
        efficientRouteEnabled = false;
    }
    renderRouteBuilderPreview();
    checkCanCalculate();
}

function renderRouteBuilderPreview() {
    // Le tappe possono essere cambiate: riallinea la disponibilità dell'"Ottimizzazione percorso"
    updateEfficientRouteButton();

    if (!routeBuilderPreview) return;

    // Partenza e arrivo sono già nei campi: qui mostriamo SOLO le tappe intermedie,
    // in righe compatte (numero d'ordine · nome · "Piano · Zona" · rimuovi). Senza tappe la preview
    // resta nascosta (con sola partenza+arrivo duplicherebbe i campi).
    if (waypoints.length === 0) {
        routeBuilderPreview.innerHTML = '';
        routeBuilderPreview.hidden = true;
        if (routeBuilderHeader) routeBuilderHeader.hidden = true;
        return;
    }
    routeBuilderPreview.hidden = false;
    if (routeBuilderHeader) routeBuilderHeader.hidden = false;

    const canReorder = waypoints.length > 1;

    routeBuilderPreview.innerHTML = `
        ${waypoints.map((shop, index) => `
            <div class="route-builder-stop route-builder-mid">
                <span class="route-builder-num">${index + 1}</span>
                <div class="route-builder-stop-meta">
                    <span class="shop-name">${escapeHtml(shop.name)}</span>
                    <span class="shop-floor">Piano ${shop.floor} · ${getZoneLabel(shop.zone)}</span>
                </div>
                <div class="route-builder-actions">
                    ${canReorder ? `
                        <button class="route-builder-move" data-index="${index}" data-dir="up" aria-label="Sposta la tappa su" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button class="route-builder-move" data-index="${index}" data-dir="down" aria-label="Sposta la tappa giù" ${index === waypoints.length - 1 ? 'disabled' : ''}>↓</button>
                    ` : ''}
                    <button class="route-builder-remove" data-index="${index}" aria-label="Rimuovi tappa">×</button>
                </div>
            </div>
        `).join('')}
    `;

    routeBuilderPreview.querySelectorAll('.route-builder-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            removeWaypoint(idx);
        });
    });

    routeBuilderPreview.querySelectorAll('.route-builder-move').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            moveWaypoint(idx, btn.dataset.dir === 'up' ? -1 : 1);
        });
    });
}

function checkCanCalculate() {
    // Abilita quando partenza e arrivo sono entrambi selezionati
    calculateBtn.disabled = !(selectedStartShop && (selectedEndShop || bathroomQuickEnabled));
}

function getRouteStops(endOverride = null, legCache = new Map()) {
    const endShop = endOverride || selectedEndShop;
    if (!selectedStartShop || !endShop) return [];

    const intermediateStops = waypoints.slice();
    const orderedWaypoints = efficientRouteEnabled
        ? optimizeWaypoints(selectedStartShop, intermediateStops, endShop, legCache)
        : intermediateStops;

    return [selectedStartShop, ...orderedWaypoints, endShop];
}

function getLegKey(startId, endId) {
    return `${startId}=>${endId}`;
}

function getLegResult(startShop, endShop, cache) {
    const key = getLegKey(startShop.id, endShop.id);
    if (cache.has(key)) return cache.get(key);

    const result = navigationService.findShortestPathById(startShop.id, endShop.id);
    cache.set(key, result);
    return result;
}

function findNearestBathroom(startShop, legCache = new Map()) {
    if (!startShop) return null;

    const bathrooms = SHOPS_DATA.filter(shop => shop.type === 'Bagni' && shop.id !== startShop.id);
    if (bathrooms.length === 0) return null;

    const cache = legCache;
    let best = null;

    bathrooms.forEach(bathroom => {
        const result = getLegResult(startShop, bathroom, cache);
        if (result.error) return;
        if (!best || result.stepsCount < best.stepsCount) {
            best = { shop: bathroom, stepsCount: result.stepsCount };
        }
    });

    return best ? best.shop : null;
}

function optimizeWaypoints(startShop, intermediateStops, endShop, legCache = new Map()) {
    if (intermediateStops.length <= 1) return intermediateStops;

    // Per pochi waypoint cerchiamo la sequenza migliore esatta; altrimenti usiamo un greedy semplice.
    if (intermediateStops.length <= 7) {
        const cache = legCache;
        let bestOrder = intermediateStops.slice();
        let bestCost = Infinity;
        const used = new Array(intermediateStops.length).fill(false);
        const current = [];

        const evaluateCurrent = () => {
            let cost = 0;
            let previous = startShop;

            for (const stop of current) {
                const leg = getLegResult(previous, stop, cache);
                if (leg.error) return;
                cost += leg.stepsCount;
                previous = stop;
            }

            const finalLeg = getLegResult(previous, endShop, cache);
            if (finalLeg.error) return;
            cost += finalLeg.stepsCount;

            if (cost < bestCost) {
                bestCost = cost;
                bestOrder = current.slice();
            }
        };

        const backtrack = () => {
            if (current.length === intermediateStops.length) {
                evaluateCurrent();
                return;
            }

            for (let i = 0; i < intermediateStops.length; i++) {
                if (used[i]) continue;
                used[i] = true;
                current.push(intermediateStops[i]);
                backtrack();
                current.pop();
                used[i] = false;
            }
        };

        backtrack();
        return bestOrder;
    }

    const cache = new Map();
    const remaining = intermediateStops.slice();
    const ordered = [];
    let current = startShop;

    while (remaining.length > 0) {
        let bestIndex = 0;
        let bestScore = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const leg = getLegResult(current, remaining[i], cache);
            if (leg.error) continue;
            if (leg.stepsCount < bestScore) {
                bestScore = leg.stepsCount;
                bestIndex = i;
            }
        }

        const [chosen] = remaining.splice(bestIndex, 1);
        ordered.push(chosen);
        current = chosen;
    }

    return ordered;
}

// Calcola percorso
calculateBtn.addEventListener('click', () => {
    // Determina lista di leg da calcolare
    if (!navigationService) {
        showError('Servizio di navigazione non inizializzato');
        return;
    }

    // Un'unica cache per l'intero calcolo: i leg già risolti durante il TSP o la
    // ricerca del bagno non vengono ricalcolati nel loop finale.
    const legCache = new Map();

    let quickDestination = null;
    if (bathroomQuickEnabled) {
        if (!selectedStartShop) {
            showError('Seleziona una partenza per trovare il bagno piu vicino');
            return;
        }

        quickDestination = findNearestBathroom(selectedStartShop, legCache);
        if (!quickDestination) {
            showError('Nessun bagno trovato nel centro commerciale');
            return;
        }

        if (endShopInput) {
            endShopInput.value = quickDestination.name;
        }
    }

    const routeStopsSequence = getRouteStops(quickDestination, legCache);
    if (routeStopsSequence.length < 2) {
        return;
    }

    const legs = [];
    for (let i = 0; i < routeStopsSequence.length - 1; i++) {
        legs.push({ start: routeStopsSequence[i], end: routeStopsSequence[i + 1] });
    }

    // Mostra loading
    searchSection.style.display = 'none';
    loadingSection.style.display = 'block';
    hideError();

    const combined = {
        success: true,
        startShop: null,
        endShop: null,
        steps: [],
        stepsCount: 0
    };

    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const res = getLegResult(leg.start, leg.end, legCache);
        if (res.error) {
            showError(res.error);
            loadingSection.style.display = 'none';
            searchSection.style.display = 'block';
            return;
        }

        if (i === 0) {
            combined.startShop = res.startShop;
        }

        // Evita duplicare lo shop di transizione
        if (combined.steps.length > 0 && res.steps.length > 0) {
            const firstStep = res.steps[0];
            const lastCombinedStep = combined.steps[combined.steps.length - 1];
            if (firstStep.type === 'shop' && lastCombinedStep.type === 'shop' && firstStep.shop.id === lastCombinedStep.shop.id) {
                combined.steps = combined.steps.concat(res.steps.slice(1));
            } else {
                combined.steps = combined.steps.concat(res.steps);
            }
        } else {
            combined.steps = combined.steps.concat(res.steps);
        }

        combined.endShop = res.endShop;
        combined.stepsCount += res.stepsCount;
    }

    if (combined.steps.length === 0) {
        showError('Nessun percorso trovato');
        loadingSection.style.display = 'none';
        searchSection.style.display = 'block';
        return;
    }

    showRoute(combined, routeStopsSequence);
    goToRoute();
    history.pushState({ screen: 'route' }, '');
});

// Toast errore volante (#errorToast), stesso pattern del progress-toast. Deve
// essere fixed: un messaggio inline sotto il form su mobile resta fuori viewport
// e passa inosservato. Creato al primo uso, si dissolve dopo 4s.
let errorToastTimer = null;

function showError(message) {
    let toast = document.getElementById('errorToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'errorToast';
        toast.className = 'error-toast';
        toast.setAttribute('role', 'alert');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    // reflow forzato: rilancia la transizione anche su errori consecutivi
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(errorToastTimer);
    errorToastTimer = setTimeout(hideError, 4000);
}

function hideError() {
    clearTimeout(errorToastTimer);
    const toast = document.getElementById('errorToast');
    if (toast) toast.classList.remove('show');
}

// Stima tempo di percorrenza dal numero di step. Il grafo non ha metri: questi
// due valori sono knob di calibrazione — vanno tarati confrontando l'output con
// una stima reale (es. sito Porta di Roma), non ricavati dalla teoria.
// ponytail: stima da conteggio step; passare a costo-grafo pesato solo se il
// confronto mostra errori correlati agli attraversamenti isola/scale.
const SECONDS_PER_SHOP = 12;   // camminata lenta da galleria, ~12m di vetrina a passo
const SECONDS_PER_STAIR = 30;  // avvicinamento + attesa + corsa scala mobile

function estimateWalkTime(steps) {
    const shopSteps = steps.filter(s => s.type === 'shop');
    const stairCount = steps.filter(s => s.type === 'stair').length;
    // I negozi attraversati contano la loro larghezza (width, default 1): passare
    // davanti a un fronte largo come Conad costa 17 vetrine di camminata, non una.
    // Partenza e arrivo contano 1: di un negozio largo non si costeggia il fronte
    // se ci si entra o se ne esce.
    const walkUnits = shopSteps.reduce((n, s, i) => {
        const isEndpoint = i === 0 || i === shopSteps.length - 1;
        return n + (isEndpoint ? 1 : (s.shop.width || 1));
    }, 0);
    const totalSec = Math.max(0, walkUnits - 1) * SECONDS_PER_SHOP + stairCount * SECONDS_PER_STAIR;
    const lowMin = Math.max(1, Math.round((totalSec / 60) * 0.85));
    const highMin = Math.max(lowMin + 1, Math.round((totalSec / 60) * 1.15));
    return `~${lowMin}-${highMin} min`;
}

// --- Stato "segna-progresso" del risultato (solo in memoria, azzerato a ogni calcolo) ---
let currentRouteResult = null;   // { steps: [...] } dell'ultimo percorso mostrato
let currentWaypointIds = [];     // ID delle tappe intermedie dell'ultimo percorso (per i badge TAPPA)
let progressIndex = -1;          // indice step "fatto" più avanzato (-1 = niente superato)
let passedCollapsed = true;      // sezione "Già passati" collassata di default
let stopsExpanded = false;       // riepilogo: tappe intermedie collassate di default
let progressToastTimer = null;   // timer auto-dismiss del toast "tocca i negozi che superi"

function showRoute(result, routeStopsSequence) {
    renderRouteStops(routeStopsSequence);
    routeTime.textContent = estimateWalkTime(result.steps);

    // reset stato progresso a ogni nuovo percorso
    currentRouteResult = result;
    currentWaypointIds = routeStopsSequence.slice(1, -1).map(s => s.id);
    progressIndex = -1;
    passedCollapsed = true;
    stopsExpanded = false;
    renderRouteSteps();

    // Toast scopribilità del tap-per-superare: appare a ogni nuovo percorso con ≥3 negozi
    // (con solo partenza+arrivo non c'è nulla di intermedio da segnare)
    if (result.steps.filter(s => s.type === 'shop').length > 2) {
        showProgressToast();
    }

    // Show feedback banner
    const feedbackBanner = document.getElementById('feedbackBanner');
    if (feedbackBanner) {
        feedbackBanner.style.display = 'flex';
    }
}

// Toast semitrasparente non-interattivo (pointer-events:none → i tap lo attraversano):
// spiega il tap-per-superare, si dissolve dopo 4s o al primo tap su un negozio.
function showProgressToast() {
    let toast = document.getElementById('progressToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'progressToast';
        toast.className = 'progress-toast';
        toast.innerHTML = '<span aria-hidden="true">👆</span><span>Tocca i negozi che superi per tenere il segno</span>';
        document.body.appendChild(toast);
    }
    // reflow forzato: rilancia la transizione anche su percorsi consecutivi
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(progressToastTimer);
    progressToastTimer = setTimeout(hideProgressToast, 6000);
}

function hideProgressToast() {
    clearTimeout(progressToastTimer);
    const toast = document.getElementById('progressToast');
    if (toast) toast.classList.remove('show');
}

// Costruisce la sequenza ordinata di "render item" del percorso (side-hint / negozio / scala),
// ognuno etichettato con lo `stepIndex` di riferimento per poterli splittare in passati/attivi.
// Una side-hint eredita lo stepIndex del negozio che precede: è "fatta" quando quel negozio lo è.
function buildRouteItems(result) {
    const items = [];
    let lastSide = null;
    let shopNumber = 0;
    // Tappa = prima occorrenza del suo ID negli step (la giunzione tra i leg);
    // un eventuale ri-passaggio davanti allo stesso negozio resta riga compatta.
    const pendingWaypoints = new Map(currentWaypointIds.map((id, i) => [id, i + 1]));
    result.steps.forEach((step, index) => {
        if (step.type === 'shop') {
            shopNumber++;
            const side = getWalkSide(step.shop.zone);
            const isStart = index === 0;
            const isEnd = index === result.steps.length - 1;
            let waypointNum = null;
            if (!isStart && !isEnd && pendingWaypoints.has(step.shop.id)) {
                waypointNum = pendingWaypoints.get(step.shop.id);
                pendingWaypoints.delete(step.shop.id);
            }
            const shopItem = {
                kind: 'shop', shop: step.shop, stepIndex: index, shopNumber,
                isStart, isEnd, waypointNum
            };
            if (side !== lastSide) {
                // La primissima hint (index 0) orienta l'uscita DALLA partenza e va dopo
                // la card PARTENZA. Ma se il negozio successivo incrocia già lato, quella
                // partenza non ha un tratto reale da descrivere: mostrarla produrrebbe
                // "vai interno" seguito a zero negozi di distanza da "vai esterno" per il
                // negozio successivo. In quel caso si salta la hint di apertura e resta
                // solo quella corretta, prima del negozio a cui prepara.
                const nextStep = result.steps[index + 1];
                const opensWithImmediateCrossing = index === 0 &&
                    nextStep?.type === 'shop' && getWalkSide(nextStep.shop.zone) !== side;

                if (opensWithImmediateCrossing) {
                    items.push(shopItem);
                } else {
                    const sideItem = { kind: 'side', side, stepIndex: index };
                    if (index === 0) {
                        items.push(shopItem, sideItem);
                    } else {
                        items.push(sideItem, shopItem);
                    }
                }
                lastSide = side;
            } else {
                items.push(shopItem);
            }
        } else if (step.type === 'stair') {
            items.push({ kind: 'stair', instruction: step.instruction, isGoingUp: step.isGoingUp, stepIndex: index });
            lastSide = null; // cambio piano: ri-orienta il lato al piano nuovo
        }
    });
    return items;
}

// Ridisegna la lista degli step tenendo conto del progresso: i passati finiscono in una
// sezione collassabile in cima, gli attivi restano sotto col "prossimo" evidenziato.
function renderRouteSteps() {
    if (!currentRouteResult) return;
    const items = buildRouteItems(currentRouteResult);
    const totalShops = currentRouteResult.steps.filter(s => s.type === 'shop').length;

    const done = items.filter(it => it.stepIndex <= progressIndex);
    const active = items.filter(it => it.stepIndex > progressIndex);
    const doneShops = done.filter(it => it.kind === 'shop').length;

    stepsContainer.innerHTML = '';

    // Sezione "Già passati" (solo se c'è almeno un negozio superato)
    if (doneShops > 0) {
        stepsContainer.appendChild(createPassedSection(done, doneShops, totalShops));
    }

    // Il primo negozio attivo è il "prossimo" (dove sei diretto)
    const currentShopStepIndex = active.find(it => it.kind === 'shop')?.stepIndex;

    active.forEach(it => {
        if (it.kind === 'side') {
            stepsContainer.appendChild(createSideHintCard(it.side));
        } else if (it.kind === 'stair') {
            stepsContainer.appendChild(createStairCard(it.instruction, it.isGoingUp));
        } else {
            const card = createShopStepCard(it.shop, it.shopNumber, it.isStart, it.isEnd, it.waypointNum);
            card.classList.add('tappable');
            if (it.stepIndex === currentShopStepIndex) {
                card.classList.remove('compact'); // il "prossimo" torna card piena, risalta
                card.classList.add('current');
                if (progressIndex >= 0 && !it.isEnd) {
                    const details = card.querySelector('.step-details');
                    if (details) {
                        const pill = document.createElement('span');
                        pill.className = 'step-badge badge-current';
                        pill.textContent = 'PROSSIMO';
                        details.appendChild(pill);
                    }
                }
            }
            card.addEventListener('click', () => markProgress(it.stepIndex));
            stepsContainer.appendChild(card);
        }
    });

    // Nessun attivo = percorso completato
    if (active.length === 0) {
        const doneMsg = document.createElement('div');
        doneMsg.className = 'route-arrived';
        doneMsg.textContent = '🎉 Arrivato!';
        stepsContainer.appendChild(doneMsg);
    }
}

// Sezione collassabile coi passi già superati; l'header fa da contatore ("N di M").
function createPassedSection(doneItems, doneShops, totalShops) {
    const wrap = document.createElement('div');
    wrap.className = 'passed-section' + (passedCollapsed ? ' collapsed' : '');

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'passed-header';
    header.setAttribute('aria-expanded', String(!passedCollapsed));
    header.innerHTML = `
        <span class="passed-check">✓</span>
        <span class="passed-title">Già passati <strong>${doneShops} di ${totalShops}</strong></span>
        <span class="passed-caret" aria-hidden="true">▾</span>
    `;
    header.addEventListener('click', () => {
        passedCollapsed = !passedCollapsed;
        renderRouteSteps();
    });
    wrap.appendChild(header);

    const body = document.createElement('div');
    body.className = 'passed-body';
    doneItems.forEach(it => {
        if (it.kind === 'side') return; // le guide di lato non le rimostro tra i passati (rumore)
        if (it.kind === 'stair') {
            const el = createStairCard(it.instruction, it.isGoingUp);
            el.classList.add('done');
            body.appendChild(el);
            return;
        }
        const card = createShopStepCard(it.shop, it.shopNumber, it.isStart, it.isEnd, it.waypointNum);
        card.classList.add('done', 'tappable');
        card.title = 'Tocca per tornare qui';
        const num = card.querySelector('.step-number');
        if (num) num.textContent = '✓';
        // tap su un passato = torna qui: quel negozio ridiventa il "prossimo"
        card.addEventListener('click', () => markProgress(it.stepIndex - 1));
        body.appendChild(card);
    });
    wrap.appendChild(body);
    return wrap;
}

function markProgress(newIndex) {
    progressIndex = newIndex;
    hideProgressToast(); // il primo tap conferma che l'utente ha capito: via il suggerimento
    renderRouteSteps();
}

function renderRouteStops(routeStopsSequence) {
    if (!routeStops) return;

    const stops = routeStopsSequence;
    const lastIndex = stops.length - 1;
    const midCount = Math.max(0, stops.length - 2);
    const collapsible = midCount >= 2;

    function stopRow(stop, index, hasLineBelow) {
        let typeClass;
        if (index === 0) typeClass = 'tl-start';
        else if (index === lastIndex) typeClass = 'tl-end';
        else typeClass = 'tl-mid';
        return `
        <div class="tl-stop ${typeClass}">
            <div class="tl-marker">
                <div class="tl-dot"></div>
                ${hasLineBelow ? '<div class="tl-line"></div>' : ''}
            </div>
            <div class="tl-info">
                <span class="tl-name">${escapeHtml(stop.name)}</span>
                <span class="tl-floor">Piano ${stop.floor}</span>
            </div>
        </div>`;
    }

    let markup = '<div class="route-timeline">';

    if (!collapsible) {
        stops.forEach((stop, index) => {
            markup += stopRow(stop, index, index !== lastIndex);
        });
    } else {
        markup += stopRow(stops[0], 0, true);
        markup += `
        <button type="button" class="tl-toggle${stopsExpanded ? ' expanded' : ''}" aria-expanded="${stopsExpanded}">
            <div class="tl-marker">
                <div class="tl-dot tl-dot-more"></div>
                <div class="tl-line"></div>
            </div>
            <div class="tl-toggle-body">
                <span class="tl-toggle-text">${midCount} tappe intermedie</span>
                <span class="tl-caret" aria-hidden="true">▾</span>
            </div>
        </button>`;
        markup += `<div class="tl-mids"${stopsExpanded ? '' : ' hidden'}>`;
        for (let i = 1; i <= midCount; i++) {
            markup += stopRow(stops[i], i, true);
        }
        markup += '</div>';
        markup += stopRow(stops[lastIndex], lastIndex, false);
    }

    markup += '</div>';
    routeStops.innerHTML = markup;

    const toggle = routeStops.querySelector('.tl-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            stopsExpanded = !stopsExpanded;
            renderRouteStops(routeStopsSequence);
        });
    }
}

function createShopStepCard(shop, stepNumber, isStart, isEnd, waypointNum) {
    const card = document.createElement('div');
    card.className = 'step-card';
    if (isStart) card.classList.add('start');
    if (isEnd) card.classList.add('end');
    if (waypointNum) card.classList.add('waypoint');
    // Negozi intermedi = landmark: riga compatta (peso visivo ridotto) così partenza,
    // scale e arrivo risaltano come gli unici eventi "grandi" del percorso.
    if (!isStart && !isEnd) card.classList.add('compact');

    let badge = '';
    if (isStart) {
        badge = '<span class="step-badge badge-start">PARTENZA</span>';
    } else if (isEnd) {
        badge = '<span class="step-badge badge-end">ARRIVO</span>';
    } else if (waypointNum) {
        badge = `<span class="step-badge badge-waypoint">TAPPA ${waypointNum}</span>`;
    }

    card.innerHTML = `
        <div class="step-number">${isStart ? '<svg class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>' : isEnd ? '<svg class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-12c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>' : stepNumber}</div>
        <div class="step-content">
            <div class="step-name">${escapeHtml(shop.name)}</div>
            <div class="step-details">
                <span>Piano ${shop.floor}</span>
                <span>•</span>
                <span>${getZoneLabel(shop.zone)}</span>
                ${badge}
            </div>
        </div>
    `;

    return card;
}

function createStairCard(instruction, isGoingUp) {
    const card = document.createElement('div');
    card.className = `stair-card ${isGoingUp ? 'up' : 'down'}`;

    const svgUp = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="32" height="32" aria-hidden="true">
        <path d="M3 20h4v-4h4v-4h4v-4h4V4"/>
        <polyline points="16 7 19 4 22 7"/>
    </svg>`;

    const svgDown = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="32" height="32" aria-hidden="true">
        <path d="M3 4h4v4h4v4h4v4h4V20"/>
        <polyline points="16 17 19 20 22 17"/>
    </svg>`;

    card.innerHTML = `
        <div class="stair-icon">${isGoingUp ? svgUp : svgDown}</div>
        <div class="stair-instruction">${instruction}</div>
    `;

    return card;
}

// Lato del corridoio su cui tenersi, dedotto dalla zona del negozio: l'anello esterno (OUTER)
// sta lungo le pareti, le isole (ISLAND_*) sono al centro. Serve a orientare la camminata.
function getWalkSide(zone) {
    return zone === 'OUTER' ? 'esterno' : 'interno';
}

// Istruzione di camminata mostrata quando il percorso passa da un lato all'altro del corridoio.
// Il mini-glifo riprende la convenzione delle mappe dei centri (rettangolo = piano).
function createSideHintCard(side) {
    const card = document.createElement('div');
    card.className = `side-hint side-hint-${side}`;

    const glyphOuter = `<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="1.6" y="1.6" width="20.8" height="12.8" rx="2" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`;
    const glyphInner = `<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="1.6" y="1.6" width="20.8" height="12.8" rx="2" fill="none" stroke="currentColor" stroke-width="1" opacity="0.45"/><rect x="8" y="5" width="8" height="6" rx="1.3" fill="currentColor"/></svg>`;

    const isOuter = side === 'esterno';
    const text = isOuter
        ? 'Prosegui lungo il <strong>lato esterno</strong> (negozi sulle pareti)'
        : 'Spostati verso <strong>l\'interno</strong> (negozi sulle isole)';

    card.innerHTML = `
        <div class="side-hint-glyph">${isOuter ? glyphOuter : glyphInner}</div>
        <div class="side-hint-text">${text}</div>
    `;
    return card;
}

// Reset condiviso dello stato di selezione percorso (usato da backBtn e changeMallBtn)
function resetRouteSelection() {
    selectedStartShop = null;
    selectedEndShop = null;
    waypoints = [];
    renderRouteBuilderPreview();
    efficientRouteEnabled = false;
    updateEfficientRouteButton();
    bathroomQuickEnabled = false;
    savedEndShop = null;      // reset completo: nessun input da ripristinare
    savedWaypoints = [];
    updateBathroomQuickToggle();
    hideError();
}

// Transizioni di schermata. Ognuna fa solo il display + i side effect, NON tocca
// la cronologia: quella la guidano i forward (pushState) e popstate.
function goToSearch() {
    document.body.dataset.screen = 'search';
    hideProgressToast();
    routeSection.style.display = 'none';
    mallSelectionSection.style.display = 'none';
    mainHeader.style.display = 'block';
    searchSection.style.display = 'block';

    // Reset form
    startShopInput.value = '';
    endShopInput.value = '';
    waypointInput && (waypointInput.value = '');
    resetRouteSelection();
    checkCanCalculate();

    const feedbackBanner = document.getElementById('feedbackBanner');
    if (feedbackBanner) feedbackBanner.style.display = 'none';
    window.scrollTo(0, 0);
}

function goToRoute() {
    document.body.dataset.screen = 'route';
    mallSelectionSection.style.display = 'none';
    searchSection.style.display = 'none';
    mainHeader.style.display = 'none';
    loadingSection.style.display = 'none';
    routeSection.style.display = 'block';
    window.scrollTo(0, 0);
}

// Il bottone in pagina delega al tasto Indietro del browser, così la cronologia
// resta allineata col tasto Indietro del telefono (la transizione la fa popstate).
backBtn.addEventListener('click', () => history.back());

// === GESTIONE SELEZIONE MALL ===
function initializeMallSelection() {
    // Nella griglia entrano solo i centri attivi; i "comingSoon" diventano una nota a fine lista.
    // mall.logo è volutamente NON escapato: contiene markup <img> per definizione (MALLS_CONFIG).
    mallsGrid.innerHTML = MALLS_CONFIG.filter(mall => !mall.comingSoon).map(mall => `
        <div class="mall-card" data-mall-id="${escapeHtml(mall.id)}">
            <div class="mall-logo">${mall.logo}</div>
            <div class="mall-info">
                <h3 class="mall-name">${escapeHtml(mall.name)}</h3>
                <p class="mall-location">${escapeHtml(mall.location)}</p>
                <div class="mall-stats-mini">
                    <span>${MALLS_DATA[mall.id].length} negozi</span>
                    <span>•</span>
                    <span>${mall.floors} piani</span>
                </div>
            </div>
            <button class="btn-select-mall">Entra →</button>
        </div>
    `).join('');

    // Nota discreta "altri centri in arrivo", solo se esiste almeno un centro comingSoon
    const comingSoonNote = document.getElementById('comingSoonNote');
    if (comingSoonNote) {
        comingSoonNote.hidden = !MALLS_CONFIG.some(mall => mall.comingSoon);
    }

    // Aggiungi event listeners - rendi cliccabile l'intera card
    document.querySelectorAll('.mall-card:not(.coming-soon)').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            const mallId = card.dataset.mallId;
            selectMall(mallId);
        });
    });

    // Filtro città
    const cityWrapper = document.querySelector('.city-filter-wrapper');
    const cityBtn = document.getElementById('cityFilterBtn');
    const cityMenu = document.getElementById('cityFilterMenu');

    const cities = [...new Set(
        MALLS_CONFIG
            .filter(m => !m.comingSoon)
            .map(m => m.location.split(',')[0].trim())
    )];

    // Con 0 o 1 città il filtro aggiunge solo un passaggio mentale senza valore: nascondilo
    if (cityWrapper) {
        cityWrapper.style.display = cities.length > 1 ? '' : 'none';
    }

    // Setup eventi eseguito una sola volta, e solo se il filtro è effettivamente utile
    if (cityBtn && cityMenu && cityMenu.children.length === 0 && cities.length > 1) {
        let activeCityFilter = 'all';

        function renderCityMenu() {
            const options = [{ value: 'all', label: 'Tutte le città' }, ...cities.map(c => ({ value: c, label: c }))];
            cityMenu.innerHTML = options.map(opt => `
                <div class="filter-option ${activeCityFilter === opt.value ? 'active' : ''}" role="option" tabindex="0" aria-selected="${activeCityFilter === opt.value}" data-city="${escapeHtml(opt.value)}">
                    <span>${escapeHtml(opt.label)}</span>
                    <span class="filter-check">✓</span>
                </div>
            `).join('');
            cityMenu.querySelectorAll('.filter-option').forEach(option => {
                option.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        option.click();
                    }
                });
                option.addEventListener('click', () => {
                    activeCityFilter = option.dataset.city;
                    cityBtn.innerHTML = `<svg class="filter-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16l-6 8v6l-4 2v-8L4 4z"/></svg>${escapeHtml(option.querySelector('span').textContent)}`;
                    renderCityMenu();
                    closeCategoryMenu(cityBtn, cityMenu);
                    document.querySelectorAll('#mallsGrid .mall-card').forEach(card => {
                        const mall = MALLS_CONFIG.find(m => m.id === card.dataset.mallId);
                        if (!mall) return;
                        const cardCity = mall.location.split(',')[0].trim();
                        card.style.display = (activeCityFilter === 'all' || mall.comingSoon || cardCity === activeCityFilter) ? '' : 'none';
                    });
                });
            });
        }

        renderCityMenu();

        cityBtn.addEventListener('click', () => {
            toggleCategoryMenu(cityBtn, cityMenu);
        });

        document.addEventListener('click', (e) => {
            if (!cityBtn.contains(e.target) && !cityMenu.contains(e.target)) {
                closeCategoryMenu(cityBtn, cityMenu);
            }
        });
    }
}

// options.replaceHistory: al ripristino da refresh l'entry corrente è già 'search'
// (history.state sopravvive al reload) → replace invece di push, per non
// accumulare entry duplicate a ogni refresh.
function selectMall(mallId, options = {}) {
    const mall = MALLS_CONFIG.find(m => m.id === mallId);
    if (!mall || mall.comingSoon) return;

    // Salva la selezione
    selectedMall = mall;
    SHOPS_DATA = MALLS_DATA[mallId] || [];
    
    // Salva in sessionStorage (ripristinato al refresh della stessa scheda)
    sessionStorage.setItem('selectedMall', mallId);

    // Inizializza il servizio di navigazione col mall esplicito (niente detection da prefisso ID)
    navigationService = new NavigationService(SHOPS_DATA, mallId);
    activeStartCategoryFilter = 'Tutto';
    activeEndCategoryFilter = 'Tutto';
    activeWaypointCategoryFilter = 'Tutto';
    refreshCategoryFilters();

    // Mostra il toggle "Bagno" solo se il centro ha bagni mappati
    updateBathroomFeatureAvailability();

    // Aggiorna UI
    document.getElementById('mallTitle').textContent = mall.name;

    // Aggiorna stats
    updateStats(mall);

    // Mostra la sezione di ricerca
    document.body.dataset.screen = 'search';
    mallSelectionSection.style.display = 'none';
    mainHeader.style.display = 'block';
    searchSection.style.display = 'block';
    window.scrollTo(0, 0);

    if (options.replaceHistory) {
        history.replaceState({ screen: 'search' }, '');
    } else {
        history.pushState({ screen: 'search' }, '');
    }
}

function updateStats(mall) {
    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) return;
    // Un tempo qui c'erano 3 riquadri (Negozi/Piani/Scale Mobili): info sul centro, non utili al
    // compito dell'utente. Resta solo l'azione utile — sfogliare i negozi — resa pulsante esplicito
    // (prima era un "202" che sembrava una statistica, non un bottone).
    statsGrid.innerHTML = `
        <button type="button" class="browse-shops-btn" id="shopsStatCard">
            <span class="browse-shops-icon" aria-hidden="true">📋</span>
            <span class="browse-shops-text">Sfoglia tutti i negozi</span>
            <span class="browse-shops-count">${SHOPS_DATA.length}</span>
        </button>
    `;

    // Aggiungi event listener per aprire il modale
    document.getElementById('shopsStatCard').addEventListener('click', openShopsModal);
}

function goToMall() {
    hideProgressToast();
    // Reset
    selectedMall = null;
    SHOPS_DATA = [];
    navigationService = null;

    // Reset form
    startShopInput.value = '';
    endShopInput.value = '';
    resetRouteSelection();

    // Rimuovi selezione salvata
    sessionStorage.removeItem('selectedMall');

    // Rigenera le card dei centri commerciali
    initializeMallSelection();

    // Mostra selezione mall
    document.body.dataset.screen = 'mall';
    searchSection.style.display = 'none';
    routeSection.style.display = 'none';
    mainHeader.style.display = 'none';
    mallSelectionSection.style.display = 'block';
    window.scrollTo(0, 0);
}

// Cambia centro = torna alla selezione via cronologia (una schermata indietro)
if (changeMallBtn) changeMallBtn.addEventListener('click', () => history.back());

// Inizializzazione
function init() {
    // Gestiamo noi lo scroll (ogni schermata riparte da capo con scrollTo(0,0)): senza
    // questo, al refresh su mobile il browser ripristina la posizione precedente e la
    // pagina resta un po' sotto la cima.
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // Entry base della cronologia = selezione centro. Così il tasto Indietro del
    // telefono naviga tra le schermate invece di uscire dal sito.
    // Se stiamo ricaricando un'entry già nostra ('search'/'route' sopravvive al
    // refresh in history.state), la base 'mall' esiste già dietro: in quel caso
    // il ripristino usa replaceState per non far crescere lo stack a ogni F5.
    const reloadedScreen = (history.state && history.state.screen) || null;
    const restoreInPlace = reloadedScreen === 'search' || reloadedScreen === 'route';
    if (!restoreInPlace) {
        history.replaceState({ screen: 'mall' }, '');
    }
    window.addEventListener('popstate', (e) => {
        const screen = e.state?.screen || 'mall';
        if (screen === 'route') goToRoute();
        else if (screen === 'search') goToSearch();
        else goToMall();
    });

    // Controlla se c'è un mall salvato
    const savedMallId = sessionStorage.getItem('selectedMall');
    if (savedMallId && MALLS_DATA[savedMallId]) {
        selectMall(savedMallId, { replaceHistory: restoreInPlace });
    } else {
        // Entry residua 'search'/'route' ma nessun mall ripristinabile: riallinea a 'mall'
        if (restoreInPlace) {
            history.replaceState({ screen: 'mall' }, '');
        }
        initializeMallSelection();
    }
    renderRouteBuilderPreview();
    checkCanCalculate();
    refreshCategoryFilters();
}

// Focus trap riusabile per i modali: finché il modale è aperto, Tab/Shift+Tab
// ciclano tra i suoi elementi focusabili invece di uscire sulla pagina sottostante.
function setupModalFocusTrap(modal) {
    if (!modal || typeof modal.addEventListener !== 'function') return;
    modal.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusables = Array.from(modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.disabled && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

// === GESTIONE MODALE LISTA NEGOZI ===
const shopsModal = document.getElementById('shopsModal');
const closeShopsModal = document.getElementById('closeShopsModal');
const shopsSearchInput = document.getElementById('shopsSearchInput');
const shopsList = document.getElementById('shopsList');
const floorFilters = document.getElementById('floorFilters');

let currentFloorFilter = 'all';
let shopsModalOpener = null; // elemento che ha aperto il modale, per ripristinare il focus

function openShopsModal() {
    if (!SHOPS_DATA || SHOPS_DATA.length === 0) return;

    shopsModalOpener = document.activeElement;

    // Genera pulsanti filtro per piani
    generateFloorFilters();

    // Popola la lista
    renderShopsList(getFilteredShops());

    // Mostra il modale
    shopsModal.classList.add('show');

    // Focus sulla ricerca
    setTimeout(() => shopsSearchInput.focus(), 100);
}

function generateFloorFilters() {
    // Trova tutti i piani unici
    const floors = [...new Set(SHOPS_DATA.map(shop => shop.floor))].sort((a, b) => a - b);
    
    // Genera pulsanti
    floorFilters.innerHTML = `
        <button class="filter-btn ${currentFloorFilter === 'all' ? 'active' : ''}" data-floor="all" aria-pressed="${currentFloorFilter === 'all'}">
            Tutti (${SHOPS_DATA.length})
        </button>
        ${floors.map(floor => {
            const count = SHOPS_DATA.filter(s => s.floor === floor).length;
            return `<button class="filter-btn ${currentFloorFilter === floor ? 'active' : ''}" data-floor="${floor}" aria-pressed="${currentFloorFilter === floor}">
                Piano ${floor} (${count})
            </button>`;
        }).join('')}
    `;

    // Aggiungi event listeners
    floorFilters.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const floor = btn.dataset.floor;
            currentFloorFilter = floor === 'all' ? 'all' : parseInt(floor);

            // Aggiorna UI
            floorFilters.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            
            // Re-render lista
            renderShopsList(getFilteredShops());
        });
    });
}

function getFilteredShops() {
    const query = shopsSearchInput.value.trim().toLowerCase();
    
    let filtered = SHOPS_DATA;
    
    // Filtra per piano
    if (currentFloorFilter !== 'all') {
        filtered = filtered.filter(shop => shop.floor === currentFloorFilter);
    }
    
    // Filtra per ricerca
    if (query) {
        filtered = filtered.filter(shop => shop.name.toLowerCase().includes(query));
    }
    
    return filtered;
}

function renderShopsList(shops) {
    // Ordina alfabeticamente
    const sortedShops = [...shops].sort((a, b) => a.name.localeCompare(b.name));
    
    // Riferimento per id (non per nome): più robusto con caratteri speciali nei nomi
    shopsList.innerHTML = sortedShops.map(shop => `
        <div class="shop-item" role="button" tabindex="0" data-shop-id="${escapeHtml(shop.id)}">
            <div class="shop-item-name">${escapeHtml(shop.name)}</div>
            <div class="shop-item-details">
                <span class="shop-item-floor">Piano ${shop.floor}</span>
            </div>
        </div>
    `).join('');

    // Aggiungi click (e tastiera) per chiudere e pre-compilare il form
    shopsList.querySelectorAll('.shop-item').forEach(item => {
        const selectItem = () => {
            const shop = SHOPS_DATA.find(s => s.id === item.dataset.shopId);
            if (shop) {
                handleShopSelection(shop);
                closeShopsModalHandler();
            }
        };
        item.addEventListener('click', selectItem);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectItem();
            }
        });
    });
}

function closeShopsModalHandler() {
    shopsModal.classList.remove('show');
    shopsSearchInput.value = '';
    currentFloorFilter = 'all';
    // Ripristina il focus su chi aveva aperto il modale
    if (shopsModalOpener && typeof shopsModalOpener.focus === 'function') {
        shopsModalOpener.focus();
    }
    shopsModalOpener = null;
}

// Event listeners modale
if (closeShopsModal) closeShopsModal.addEventListener('click', closeShopsModalHandler);
setupModalFocusTrap(shopsModal);

// Chiudi cliccando fuori dal modale
if (shopsModal) shopsModal.addEventListener('click', (e) => {
    if (e.target === shopsModal) {
        closeShopsModalHandler();
    }
});

// Chiudi con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shopsModal && shopsModal.classList.contains('show')) {
        closeShopsModalHandler();
    }
});

// Ricerca negozi in tempo reale
shopsSearchInput.addEventListener('input', () => {
    renderShopsList(getFilteredShops());
});

// Avvia l'app
init();

const mallNavDebug = {
    setRouteState({ startShop = null, endShop = null, intermediateWaypoints = [], efficient = false } = {}) {
        selectedStartShop = startShop;
        selectedEndShop = endShop;
        waypoints = intermediateWaypoints.slice();
        efficientRouteEnabled = efficient;
        if (startShop && typeof MALLS_DATA !== 'undefined') {
            const isGranRoma = startShop.id && startShop.id.startsWith('gr_');
            const mallKey = isGranRoma ? 'granroma' : 'porta_di_roma';
            navigationService = new NavigationService(MALLS_DATA[mallKey] || [], mallKey);
        }
        updateEfficientRouteButton();
        renderRouteBuilderPreview();
    },
    getRouteStops,
    optimizeWaypoints
};

// Efficient route info modal
(function () {
    const infoBtn = document.getElementById('efficientRouteInfoBtn');
    const modal = document.getElementById('efficientRouteModal');
    const closeBtn = document.getElementById('closeEfficientRouteModal');
    if (!infoBtn || !modal) return;

    const openModal = () => {
        modal.classList.add('show');
        if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
    };
    const closeModal = () => {
        if (!modal.classList.contains('show')) return;
        modal.classList.remove('show');
        // Il focus torna allo `?` che aveva aperto il popup
        if (typeof infoBtn.focus === 'function') infoBtn.focus();
    };

    infoBtn.addEventListener('click', openModal);
    // Lo `?` è uno span dentro il toggle: attivabile anche da tastiera
    infoBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal();
        }
    });
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
    setupModalFocusTrap(modal);
})();

// Hook di debug esposto SOLO in ambiente locale (localhost, file://, harness node):
// in produzione window.__mallNavDebug non esiste.
const isLocalDebugHost = typeof window === 'undefined'
    || !window.location
    || ['localhost', '127.0.0.1', ''].includes(window.location.hostname || '');

if (isLocalDebugHost) {
    if (typeof window !== 'undefined') {
        window.__mallNavDebug = mallNavDebug;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.__mallNavDebug = mallNavDebug;
    }
}
