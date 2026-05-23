const fs = require('fs');
const vm = require('vm');

function makeClassList() {
  const classes = new Set();
  return {
    add: (...items) => items.forEach(item => classes.add(item)),
    remove: (...items) => items.forEach(item => classes.delete(item)),
    toggle: (item, force) => {
      if (force === true) { classes.add(item); return true; }
      if (force === false) { classes.delete(item); return false; }
      if (classes.has(item)) { classes.delete(item); return false; }
      classes.add(item);
      return true;
    },
    contains: item => classes.has(item),
    toString: () => [...classes].join(' ')
  };
}

function makeElement(id) {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    disabled: false,
    classList: makeClassList(),
    addEventListener() {},
    querySelectorAll() { return []; },
    appendChild() {},
    focus() {},
    contains() { return false; }
  };
}

const elementIds = [
  'mallSelectionSection','mainHeader','searchSection','loadingSection','routeSection','mallsGrid','changeMallBtn',
  'startShop','endShop','startSuggestions','endSuggestions','waypointInput','waypointSuggestions','waypointsList',
  'calculateBtn','errorMessage','backBtn','routeStops','routeSteps','stepsContainer','shopsModal','closeShopsModal',
  'shopsSearchInput','shopsList','floorFilters','feedbackBanner','cookieConsent','cookieAccept','cookieReject',
  'navToggle','navMenu','mallTitle','mallSubtitle','statsGrid','shopsStatCard'
];

const elements = new Map(elementIds.map(id => [id, makeElement(id)]));
const documentStub = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement(tag) { return makeElement(tag); }
};

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  document: documentStub,
  window: { location: { pathname: '/index.html' } },
  globalThis: null,
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  Node: { },
  HTMLElement: function () {},
  addEventListener() {},
};
sandbox.globalThis = sandbox;
sandbox.window.document = documentStub;
sandbox.window.sessionStorage = sandbox.sessionStorage;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.console = console;
sandbox.window.setTimeout = setTimeout;
sandbox.window.clearTimeout = clearTimeout;

vm.createContext(sandbox);

const root = __dirname + '/../';

const dataCode = fs.readFileSync(root + 'data.js', 'utf8') + '\n;MALLS_DATA;';
sandbox.MALLS_DATA = new vm.Script(dataCode, { filename: 'data.js' }).runInContext(sandbox);

const navCode = fs.readFileSync(root + 'navigation.js', 'utf8') + '\n;NavigationService;';
sandbox.NavigationService = new vm.Script(navCode, { filename: 'navigation.js' }).runInContext(sandbox);

const appCode = fs.readFileSync(root + 'app.js', 'utf8');
new vm.Script(appCode, { filename: 'app.js' }).runInContext(sandbox);

const debug = sandbox.__mallNavDebug || sandbox.window.__mallNavDebug;
if (!debug) {
  console.error('Debug hooks non disponibili');
  process.exit(1);
}

const startShop = sandbox.MALLS_DATA.porta_di_roma.find(s => s.id === 'p0_outer_1');
const waypointA = sandbox.MALLS_DATA.porta_di_roma.find(s => s.id === 'p0_outer_6');
const waypointB = sandbox.MALLS_DATA.porta_di_roma.find(s => s.id === 'p1_outer_9');
const endShop = sandbox.MALLS_DATA.porta_di_roma.find(s => s.id === 'p1_outer_34');

if (!startShop || !waypointA || !waypointB || !endShop) {
  console.error('Uno o più shop di test non sono stati trovati');
  process.exit(1);
}

debug.setRouteState({
  startShop,
  endShop,
  intermediateWaypoints: [waypointA, waypointB],
  efficient: false
});

const orderedStops = debug.getRouteStops();
const orderedIds = orderedStops.map(s => s.id).join(' -> ');
console.log('Ordered route:', orderedIds);

if (orderedStops[0].id !== startShop.id || orderedStops[orderedStops.length - 1].id !== endShop.id) {
  throw new Error('Start/end non sono nelle posizioni corrette');
}
if (orderedStops.length !== 4) {
  throw new Error(`Numero tappe inatteso: ${orderedStops.length}`);
}

debug.setRouteState({
  startShop,
  endShop,
  intermediateWaypoints: [waypointA, waypointB],
  efficient: true
});

const efficientStops = debug.getRouteStops();
const efficientIds = efficientStops.map(s => s.id).join(' -> ');
console.log('Efficient route:', efficientIds);

if (efficientStops[0].id !== startShop.id || efficientStops[efficientStops.length - 1].id !== endShop.id) {
  throw new Error('Percorso efficiente ha alterato start/end');
}
if (efficientStops.length !== 4) {
  throw new Error(`Numero tappe efficiente inatteso: ${efficientStops.length}`);
}

console.log('Route logic test OK');
