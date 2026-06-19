// Copyright (c) 2026 MallNav. All rights reserved. Unauthorized use prohibited.
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
const calculateBtn = document.getElementById('calculateBtn');
const efficientRouteBtn = document.getElementById('efficientRouteBtn');
const bathroomQuickToggle = document.getElementById('bathroomQuickToggle');
const errorMessage = document.getElementById('errorMessage');
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
const routeSteps = document.getElementById('routeSteps');
const stepsContainer = document.getElementById('stepsContainer');

let selectedStartShop = null;
let selectedEndShop = null;
let waypoints = []; // array of shop objects in order
let efficientRouteEnabled = false;
let bathroomQuickEnabled = false;
let activeStartCategoryFilter = 'Tutto';
let activeEndCategoryFilter = 'Tutto';
let activeWaypointCategoryFilter = 'Tutto';

function updateEfficientRouteButton() {
    if (!efficientRouteBtn) return;
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

    // Se il centro non ha bagni, disattiva la modalità eventualmente attiva
    if (!available && bathroomQuickEnabled) {
        bathroomQuickEnabled = false;
        updateBathroomQuickToggle();
    }
}

function updateBathroomQuickToggle() {
    if (!bathroomQuickToggle) return;

    bathroomQuickToggle.classList.toggle('active', bathroomQuickEnabled);
    bathroomQuickToggle.setAttribute('aria-pressed', String(bathroomQuickEnabled));

    if (bathroomQuickEnabled) {
        selectedEndShop = null;
        waypoints = [];
    }

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
        efficientRouteEnabled = !efficientRouteEnabled;
        updateEfficientRouteButton();
    });
}

if (bathroomQuickToggle) {
    updateBathroomQuickToggle();
    bathroomQuickToggle.addEventListener('click', () => {
        bathroomQuickEnabled = !bathroomQuickEnabled;
        updateBathroomQuickToggle();
    });
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
            <div class="suggestion-item" data-shop-id="${shop.id}">
                <div class="suggestion-name">${shop.name}</div>
                <div class="suggestion-details">
                    Piano ${shop.floor} • ${getZoneLabel(shop.zone)}
                </div>
            </div>
        `).join('');

        suggestionsDiv.classList.add('show');

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
        'ISLAND_CENTER': 'Isola Centrale'
    };
    return labels[zone] || zone;
}

function handleShopSelection(shop) {
    if (!shop) return;

    if (!selectedStartShop) {
        startShopInput.value = shop.name;
        selectedStartShop = shop;
        startShopInput.focus();
    } else if (!selectedEndShop && waypoints.length === 0) {
        endShopInput.value = shop.name;
        selectedEndShop = shop;
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
            <div class="filter-option ${active ? 'active' : ''}" role="option" aria-selected="${active}" data-category="${category}">
                <span>${category}</span>
                <span class="filter-check">✓</span>
            </div>
        `;
    }).join('');

    menu.querySelectorAll('.filter-option').forEach(option => {
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

function setActiveStartCategoryFilter(category) {
    activeStartCategoryFilter = category;
    if (startCategoryFilterBtn) {
        startCategoryFilterBtn.textContent = category;
    }
    renderCategoryFilterMenu(startCategoryFilterBtn, startCategoryFilterMenu, activeStartCategoryFilter);
}

function setActiveEndCategoryFilter(category) {
    activeEndCategoryFilter = category;
    if (endCategoryFilterBtn) {
        endCategoryFilterBtn.textContent = category;
    }
    renderCategoryFilterMenu(endCategoryFilterBtn, endCategoryFilterMenu, activeEndCategoryFilter);
}

function setActiveWaypointCategoryFilter(category) {
    activeWaypointCategoryFilter = category;
    if (waypointCategoryFilterBtn) {
        waypointCategoryFilterBtn.textContent = category;
    }
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

// Setup autocomplete per entrambi i campi
setupAutocomplete(startShopInput, startSuggestions, (shop) => {
    selectedStartShop = shop;
    renderRouteBuilderPreview();
    checkCanCalculate();
}, () => activeStartCategoryFilter);

setupAutocomplete(endShopInput, endSuggestions, (shop) => {
    selectedEndShop = shop;
    renderRouteBuilderPreview();
    checkCanCalculate();
}, () => activeEndCategoryFilter);

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
    if ((selectedStartShop && selectedStartShop.id === shop.id) || (selectedEndShop && selectedEndShop.id === shop.id)) {
        showError('Le tappe di partenza e arrivo sono uguali');
        return;
    }
    // evita duplicati consecutivi
    const last = waypoints[waypoints.length - 1];
    if (last && last.id === shop.id) return;
    waypoints.push(shop);
    renderRouteBuilderPreview();
    checkCanCalculate();
}

function removeWaypoint(index) {
    if (index < 0 || index >= waypoints.length) return;
    waypoints.splice(index, 1);
    renderRouteBuilderPreview();
    checkCanCalculate();
}

function renderRouteBuilderPreview() {
    if (!routeBuilderPreview) return;

    const previewStops = [];

    if (selectedStartShop) {
        previewStops.push({ shop: selectedStartShop, label: 'PARTENZA', icon: '🏁', type: 'start' });
    }

    waypoints.forEach((shop, index) => {
        previewStops.push({ shop: null, separator: true });
        previewStops.push({ shop, label: `TAPPA ${index + 1}`, icon: '🧭', type: 'mid', index });
    });

    if (bathroomQuickEnabled) {
        if (previewStops.length > 0) {
            previewStops.push({ shop: null, separator: true });
        }
        previewStops.push({
            shop: { name: 'Bagno più vicino' },
            label: 'ARRIVO',
            icon: '🚻',
            type: 'end',
            quickDestination: true
        });
    } else if (selectedEndShop) {
        if (previewStops.length > 0) {
            previewStops.push({ shop: null, separator: true });
        }
        previewStops.push({ shop: selectedEndShop, label: 'ARRIVO', icon: '🎯', type: 'end' });
    }

    if (previewStops.length === 0) {
        routeBuilderPreview.innerHTML = '<div class="route-builder-empty">Scegli partenza, tappe e arrivo per costruire il percorso</div>';
        return;
    }

    routeBuilderPreview.innerHTML = previewStops.map(item => {
        if (item.separator) {
            return '<div class="route-builder-arrow">→</div>';
        }

        const details = item.quickDestination
            ? `${item.label} • ${item.shop.name}`
            : `${item.label} • Piano ${item.shop.floor}`;

        return `
            <div class="route-builder-stop route-builder-${item.type}">
                <span class="shop-icon">${item.icon}</span>
                <div class="route-builder-stop-meta">
                    <span class="shop-name">${item.shop.name}</span>
                    <span class="shop-floor">${details}</span>
                </div>
                ${item.type === 'mid' ? `<button class="route-builder-remove" data-index="${item.index}" aria-label="Rimuovi tappa">×</button>` : ''}
            </div>
        `;
    }).join('');

    routeBuilderPreview.querySelectorAll('.route-builder-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            removeWaypoint(idx);
        });
    });
}

function checkCanCalculate() {
    // Abilita quando partenza e arrivo sono entrambi selezionati
    calculateBtn.disabled = !(selectedStartShop && (selectedEndShop || bathroomQuickEnabled));
}

function getRouteStops(endOverride = null) {
    const endShop = endOverride || selectedEndShop;
    if (!selectedStartShop || !endShop) return [];

    const intermediateStops = waypoints.slice();
    const orderedWaypoints = efficientRouteEnabled
        ? optimizeWaypoints(selectedStartShop, intermediateStops, endShop)
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

function findNearestBathroom(startShop) {
    if (!startShop) return null;

    const bathrooms = SHOPS_DATA.filter(shop => shop.type === 'Bagni' && shop.id !== startShop.id);
    if (bathrooms.length === 0) return null;

    const cache = new Map();
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

function optimizeWaypoints(startShop, intermediateStops, endShop) {
    if (intermediateStops.length <= 1) return intermediateStops;

    // Per pochi waypoint cerchiamo la sequenza migliore esatta; altrimenti usiamo un greedy semplice.
    if (intermediateStops.length <= 7) {
        const cache = new Map();
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

    let quickDestination = null;
    if (bathroomQuickEnabled) {
        if (!selectedStartShop) {
            showError('Seleziona una partenza per trovare il bagno piu vicino');
            return;
        }

        quickDestination = findNearestBathroom(selectedStartShop);
        if (!quickDestination) {
            showError('Nessun bagno trovato nel centro commerciale');
            return;
        }

        if (endShopInput) {
            endShopInput.value = quickDestination.name;
        }
    }

    const routeStopsSequence = getRouteStops(quickDestination);
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
    errorMessage.classList.remove('show');

    const combined = {
        success: true,
        startShop: null,
        endShop: null,
        steps: [],
        stepsCount: 0
    };

    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const res = getLegResult(leg.start, leg.end, new Map());
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
    loadingSection.style.display = 'none';
    routeSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function showRoute(result, routeStopsSequence) {
    renderRouteStops(routeStopsSequence);
    routeSteps.textContent = `${result.stepsCount} passaggi`;

    // Steps
    stepsContainer.innerHTML = '';
    result.steps.forEach((step, index) => {
        if (step.type === 'shop') {
            const isStart = index === 0;
            const isEnd = index === result.steps.length - 1;
            stepsContainer.appendChild(createShopStepCard(step.shop, index + 1, isStart, isEnd));
        } else if (step.type === 'stair') {
            stepsContainer.appendChild(createStairCard(step.instruction, step.isGoingUp));
        }
    });

    // Show feedback banner
    const feedbackBanner = document.getElementById('feedbackBanner');
    if (feedbackBanner) {
        feedbackBanner.style.display = 'flex';
    }
}

function renderRouteStops(routeStopsSequence) {
    if (!routeStops) return;

    const stops = routeStopsSequence;
    let markup = '<div class="route-timeline">';

    stops.forEach((stop, index) => {
        const isFirst = index === 0;
        const isLast = index === stops.length - 1;
        const isOnly = stops.length === 1;

        let typeClass, label;
        if (isFirst) { typeClass = 'tl-start'; label = 'PARTENZA'; }
        else if (isLast) { typeClass = 'tl-end'; label = 'ARRIVO'; }
        else { typeClass = 'tl-mid'; label = `TAPPA ${index}`; }

        markup += `
        <div class="tl-stop ${typeClass}">
            <div class="tl-marker">
                <div class="tl-dot"></div>
                ${(!isLast && !isOnly) ? '<div class="tl-line"></div>' : ''}
            </div>
            <div class="tl-info">
                <span class="tl-label">${label}</span>
                <span class="tl-name">${stop.name}</span>
                <span class="tl-floor">Piano ${stop.floor}</span>
            </div>
        </div>`;
    });

    markup += '</div>';
    routeStops.innerHTML = markup;
}

function createShopStepCard(shop, stepNumber, isStart, isEnd) {
    const card = document.createElement('div');
    card.className = 'step-card';
    if (isStart) card.classList.add('start');
    if (isEnd) card.classList.add('end');

    let badge = '';
    if (isStart) {
        badge = '<span class="step-badge badge-start">PARTENZA</span>';
    } else if (isEnd) {
        badge = '<span class="step-badge badge-end">ARRIVO</span>';
    }

    card.innerHTML = `
        <div class="step-number">${isStart ? '🏁' : isEnd ? '🎯' : stepNumber}</div>
        <div class="step-content">
            <div class="step-name">${shop.name}</div>
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

    card.innerHTML = `
        <div class="stair-icon">${isGoingUp ? '🔼' : '🔽'}</div>
        <div class="stair-instruction">${instruction}</div>
    `;

    return card;
}

// Torna indietro
backBtn.addEventListener('click', () => {
    routeSection.style.display = 'none';
    searchSection.style.display = 'block';
    
    // Reset form
    startShopInput.value = '';
    endShopInput.value = '';
    waypointInput && (waypointInput.value = '');
    selectedStartShop = null;
    selectedEndShop = null;
    waypoints = [];
    renderRouteBuilderPreview();
    efficientRouteEnabled = false;
    updateEfficientRouteButton();
    bathroomQuickEnabled = false;
    updateBathroomQuickToggle();
    errorMessage.classList.remove('show');
    checkCanCalculate();

    // Hide feedback banner
    const feedbackBanner = document.getElementById('feedbackBanner');
    if (feedbackBanner) {
        feedbackBanner.style.display = 'none';
    }
});

// === GESTIONE SELEZIONE MALL ===
function initializeMallSelection() {
    mallsGrid.innerHTML = MALLS_CONFIG.map(mall => `
        <div class="mall-card ${mall.comingSoon ? 'coming-soon' : ''}" data-mall-id="${mall.id}">
            <div class="mall-logo">${mall.logo}</div>
            <h3 class="mall-name">${mall.name}</h3>
            <p class="mall-location">${mall.location}</p>
            <p class="mall-description">${mall.description}</p>
            ${!mall.comingSoon ? `
                <div class="mall-stats-mini">
                    <span>${MALLS_DATA[mall.id].length} negozi</span>
                    <span>•</span>
                    <span>${mall.floors} piani</span>
                </div>
                <button class="btn-select-mall">Seleziona</button>
            ` : `
                <div class="coming-soon-badge">Prossimamente</div>
            `}
        </div>
    `).join('');

    // Aggiungi event listeners - rendi cliccabile l'intera card
    document.querySelectorAll('.mall-card:not(.coming-soon)').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            const mallId = card.dataset.mallId;
            selectMall(mallId);
        });
    });
}

function selectMall(mallId) {
    const mall = MALLS_CONFIG.find(m => m.id === mallId);
    if (!mall || mall.comingSoon) return;

    // Salva la selezione
    selectedMall = mall;
    SHOPS_DATA = MALLS_DATA[mallId] || [];
    
    // Salva in localStorage
    sessionStorage.setItem('selectedMall', mallId);

    // Inizializza il servizio di navigazione
    navigationService = new NavigationService(SHOPS_DATA);
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
    mallSelectionSection.style.display = 'none';
    mainHeader.style.display = 'block';
    searchSection.style.display = 'block';

    // console.log(`✅ Centro commerciale ${mall.name} selezionato!`);
    // console.log(`📊 ${SHOPS_DATA.length} negozi disponibili`);
}

function updateStats(mall) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = `
        <div class="stat-card clickable" id="shopsStatCard">
            <div class="stat-number">${SHOPS_DATA.length}</div>
            <div class="stat-label">Negozi</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${mall.floors}</div>
            <div class="stat-label">Piani</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${mall.escalators}</div>
            <div class="stat-label">Scale Mobili</div>
        </div>
    `;
    
    // Aggiungi event listener per aprire il modale
    document.getElementById('shopsStatCard').addEventListener('click', openShopsModal);
}

// Bottone per cambiare centro commerciale
if (changeMallBtn) changeMallBtn.addEventListener('click', () => {
    // Reset
    selectedMall = null;
    SHOPS_DATA = [];
    navigationService = null;
    
    // Reset form
    startShopInput.value = '';
    endShopInput.value = '';
    selectedStartShop = null;
    selectedEndShop = null;
    waypoints = [];
    renderRouteBuilderPreview();
    efficientRouteEnabled = false;
    updateEfficientRouteButton();
    bathroomQuickEnabled = false;
    updateBathroomQuickToggle();
    errorMessage.classList.remove('show');
    
    // Rimuovi selezione salvata
    sessionStorage.removeItem('selectedMall');
    
    // Rigenera le card dei centri commerciali
    initializeMallSelection();
    
    // Mostra selezione mall
    searchSection.style.display = 'none';
    routeSection.style.display = 'none';
    mainHeader.style.display = 'none';
    mallSelectionSection.style.display = 'block';
});

// Inizializzazione
function init() {
    // Controlla se c'è un mall salvato
    const savedMallId = sessionStorage.getItem('selectedMall');
    if (savedMallId && MALLS_DATA[savedMallId]) {
        selectMall(savedMallId);
    } else {
        initializeMallSelection();
    }
    renderRouteBuilderPreview();
    checkCanCalculate();
    refreshCategoryFilters();
}

// === GESTIONE MODALE LISTA NEGOZI ===
const shopsModal = document.getElementById('shopsModal');
const closeShopsModal = document.getElementById('closeShopsModal');
const shopsSearchInput = document.getElementById('shopsSearchInput');
const shopsList = document.getElementById('shopsList');
const floorFilters = document.getElementById('floorFilters');

let currentFloorFilter = 'all';

function openShopsModal() {
    if (!SHOPS_DATA || SHOPS_DATA.length === 0) return;
    
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
        <button class="filter-btn ${currentFloorFilter === 'all' ? 'active' : ''}" data-floor="all">
            Tutti (${SHOPS_DATA.length})
        </button>
        ${floors.map(floor => {
            const count = SHOPS_DATA.filter(s => s.floor === floor).length;
            return `<button class="filter-btn ${currentFloorFilter === floor ? 'active' : ''}" data-floor="${floor}">
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
            floorFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
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
    
    shopsList.innerHTML = sortedShops.map(shop => `
        <div class="shop-item" data-shop-name="${shop.name}">
            <div class="shop-item-name">${shop.name}</div>
            <div class="shop-item-details">
                <span class="shop-item-floor">Piano ${shop.floor}</span>
                <span>${getZoneLabel(shop.zone)}</span>

            </div>
        </div>
    `).join('');
    
    // Aggiungi click per chiudere e pre-compilare il form
    shopsList.querySelectorAll('.shop-item').forEach(item => {
        item.addEventListener('click', () => {
            const shopName = item.dataset.shopName;
            const shop = SHOPS_DATA.find(s => s.name === shopName);
            if (shop) {
                handleShopSelection(shop);
                closeShopsModalHandler();
            }
        });
    });
}

function closeShopsModalHandler() {
    shopsModal.classList.remove('show');
    shopsSearchInput.value = '';
    currentFloorFilter = 'all';
}

// Event listeners modale
if (closeShopsModal) closeShopsModal.addEventListener('click', closeShopsModalHandler);

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
            navigationService = new NavigationService(MALLS_DATA[mallKey] || []);
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

    infoBtn.addEventListener('click', () => modal.classList.add('show'));
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') modal.classList.remove('show');
    });
})();

if (typeof window !== 'undefined') {
    window.__mallNavDebug = mallNavDebug;
}

if (typeof globalThis !== 'undefined') {
    globalThis.__mallNavDebug = mallNavDebug;
}
