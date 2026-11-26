// Copyright (c) 2026 Trovalo. All rights reserved. Unauthorized use prohibited.
// Configurazione centri commerciali
const MALLS_CONFIG = [
    {
        id: 'porta_di_roma',
        name: 'Porta di Roma',
        location: 'Roma, Italia',
        description: 'Il più grande centro commerciale di Roma',
        floors: 2,
        escalators: 3,
        logo: '<img src="assets/images/PortaDiRomaIcona.png" alt="Porta di Roma" >'
    },
    {
        id: 'granroma',
        name: 'GranRoma',
        location: 'Roma, Italia',
        description: 'Centro commerciale nella zona Est di Roma',
        floors: 2,
        escalators: 2,
        logo: '<img src="assets/images/GranRomaIcona.jpg" alt="GranRoma" >'
    },
    {
        id: 'altro_mall',
        name: 'Altri Centri Commerciali',
        location: 'In arrivo...',
        description: 'Presto disponibili altri centri',
        floors: 0,
        escalators: 0,
        logo: '🏢',
        comingSoon: true
    }
];

// Dati dei centri: un file per centro in assets/js/malls/<id>.js, caricato da index.html
// dopo questo file. Ognuno aggiunge MALLS_DATA['<id>'] = { shops, stairs, links, detours }.
const MALLS_DATA = {};

// Variabile globale per il mall selezionato
let selectedMall = null;
let SHOPS_DATA = [];
