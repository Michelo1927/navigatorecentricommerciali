// App principale
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
const calculateBtn = document.getElementById('calculateBtn');
const errorMessage = document.getElementById('errorMessage');
const backBtn = document.getElementById('backBtn');

const routeStartShop = document.getElementById('routeStartShop');
const routeEndShop = document.getElementById('routeEndShop');
const routeStartFloor = document.getElementById('routeStartFloor');
const routeEndFloor = document.getElementById('routeEndFloor');
const routeSteps = document.getElementById('routeSteps');
const stepsContainer = document.getElementById('stepsContainer');

let selectedStartShop = null;
let selectedEndShop = null;

// Gestione autocomplete
function setupAutocomplete(input, suggestionsDiv, onSelect) {
    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        
        if (query.length < 2) {
            suggestionsDiv.classList.remove('show');
            return;
        }

        const matches = SHOPS_DATA.filter(shop => 
            shop.name.toLowerCase().includes(query)
        ).slice(0, 10);

        if (matches.length === 0) {
            suggestionsDiv.classList.remove('show');
            return;
        }

        suggestionsDiv.innerHTML = matches.map(shop => `
            <div class="suggestion-item" data-shop-id="${shop.id}">
                <div class="suggestion-name">${shop.name}</div>
                <div class="suggestion-details">
                    Piano ${shop.floor} • ${getZoneLabel(shop.zone)} • Pos. ${shop.position}
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

// Setup autocomplete per entrambi i campi
setupAutocomplete(startShopInput, startSuggestions, (shop) => {
    selectedStartShop = shop;
    checkCanCalculate();
});

setupAutocomplete(endShopInput, endSuggestions, (shop) => {
    selectedEndShop = shop;
    checkCanCalculate();
});

function checkCanCalculate() {
    calculateBtn.disabled = !selectedStartShop || !selectedEndShop;
}

// Calcola percorso
calculateBtn.addEventListener('click', () => {
    if (!selectedStartShop || !selectedEndShop) return;

    // Mostra loading
    searchSection.style.display = 'none';
    loadingSection.style.display = 'block';
    errorMessage.classList.remove('show');

    // Simula un piccolo delay per UX
    setTimeout(() => {
        const result = navigationService.findShortestPath(
            selectedStartShop.name,
            selectedEndShop.name
        );

        if (result.error) {
            showError(result.error);
            loadingSection.style.display = 'none';
            searchSection.style.display = 'block';
            return;
        }

        showRoute(result);
        loadingSection.style.display = 'none';
        routeSection.style.display = 'block';
    }, 500);
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function showRoute(result) {
    // Header info
    routeStartShop.textContent = result.startShop.name;
    routeEndShop.textContent = result.endShop.name;
    routeStartFloor.textContent = `Piano ${result.startShop.floor}`;
    routeEndFloor.textContent = `Piano ${result.endShop.floor}`;
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
    selectedStartShop = null;
    selectedEndShop = null;
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
                    <span>${mall.totalShops} negozi</span>
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
    localStorage.setItem('selectedMall', mallId);

    // Inizializza il servizio di navigazione
    navigationService = new NavigationService(SHOPS_DATA);

    // Aggiorna UI
    document.getElementById('mallTitle').innerHTML = `${mall.logo} Navigatore ${mall.name}`;
    document.getElementById('mallSubtitle').textContent = mall.description;

    // Aggiorna stats
    updateStats(mall);

    // Mostra la sezione di ricerca
    mallSelectionSection.style.display = 'none';
    mainHeader.style.display = 'block';
    searchSection.style.display = 'block';

    console.log(`✅ Centro commerciale ${mall.name} selezionato!`);
    console.log(`📊 ${SHOPS_DATA.length} negozi disponibili`);
}

function updateStats(mall) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = `
        <div class="stat-card clickable" id="shopsStatCard">
            <div class="stat-number">${mall.totalShops}</div>
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
changeMallBtn.addEventListener('click', () => {
    // Reset
    selectedMall = null;
    SHOPS_DATA = [];
    navigationService = null;
    
    // Reset form
    startShopInput.value = '';
    endShopInput.value = '';
    selectedStartShop = null;
    selectedEndShop = null;
    errorMessage.classList.remove('show');
    
    // Rimuovi selezione salvata
    localStorage.removeItem('selectedMall');
    
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
    const savedMallId = localStorage.getItem('selectedMall');
    if (savedMallId && MALLS_DATA[savedMallId]) {
        selectMall(savedMallId);
    } else {
        initializeMallSelection();
    }
    checkCanCalculate();
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
                <span>•</span>
                <span>Pos. ${shop.position}</span>
            </div>
        </div>
    `).join('');
    
    // Aggiungi click per chiudere e pre-compilare il form
    shopsList.querySelectorAll('.shop-item').forEach(item => {
        item.addEventListener('click', () => {
            const shopName = item.dataset.shopName;
            const shop = SHOPS_DATA.find(s => s.name === shopName);
            if (shop) {
                // Pre-compila il campo di partenza se vuoto
                if (!selectedStartShop) {
                    startShopInput.value = shop.name;
                    selectedStartShop = shop;
                    startShopInput.focus();
                } else if (!selectedEndShop) {
                    // Altrimenti pre-compila destinazione
                    endShopInput.value = shop.name;
                    selectedEndShop = shop;
                }
                checkCanCalculate();
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
closeShopsModal.addEventListener('click', closeShopsModalHandler);

// Chiudi cliccando fuori dal modale
shopsModal.addEventListener('click', (e) => {
    if (e.target === shopsModal) {
        closeShopsModalHandler();
    }
});

// Chiudi con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shopsModal.classList.contains('show')) {
        closeShopsModalHandler();
    }
});

// Ricerca negozi in tempo reale
shopsSearchInput.addEventListener('input', () => {
    renderShopsList(getFilteredShops());
});

// Avvia l'app
init();
