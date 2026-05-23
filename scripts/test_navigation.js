const fs = require('fs');
const vm = require('vm');

const workspaceRoot = __dirname + '/../';
const dataPath = workspaceRoot + 'data.js';
const navPath = workspaceRoot + 'navigation.js';

vm.createContext(global); // allow scripts to define globals in this context

// Load data.js and capture MALLS_DATA by returning it as last expression
const dataCode = fs.readFileSync(dataPath, 'utf8') + '\n;MALLS_DATA;';
const dataScript = new vm.Script(dataCode, { filename: dataPath });
const MALLS_DATA = dataScript.runInThisContext();

// Load navigation.js and capture NavigationService class as last expression
const navCode = fs.readFileSync(navPath, 'utf8') + '\n;NavigationService;';
const navScript = new vm.Script(navCode, { filename: navPath });
const NavigationService = navScript.runInThisContext();

if (!MALLS_DATA || !NavigationService) {
    console.error('Fallito a caricare MALLS_DATA o NavigationService');
    process.exit(1);
}

const shops = MALLS_DATA['porta_di_roma'];
const nav = new NavigationService(shops);

console.log('Shops caricati:', shops.length);

function printResult(r) {
    if (r.error) { console.log('ERROR:', r.error); return; }
    console.log(`Path ${r.startShop.name} -> ${r.endShop.name} => stepsCount=${r.stepsCount}`);
    console.log('Steps preview:');
    r.steps.slice(0, 10).forEach((s, i) => {
        if (s.type === 'shop') console.log(`  ${i+1}. SHOP: ${s.shop.name} (id=${s.shop.id})`);
        else console.log(`  ${i+1}. STAIR: ${s.instruction}`);
    });
}

// Test singolo leg
const res1 = nav.findShortestPathById('p0_outer_1', 'p0_outer_6');
printResult(res1);

// Test multi-leg concat (1->6 then 6->p1_outer_9 (McDonald's))
const resA = nav.findShortestPathById('p0_outer_1', 'p0_outer_6');
const resB = nav.findShortestPathById('p0_outer_6', 'p1_outer_9');

if (resA.error || resB.error) {
    printResult(resA);
    printResult(resB);
    process.exit(1);
}

let combinedSteps = [];
if (resA.steps.length > 0) combinedSteps = combinedSteps.concat(resA.steps);
if (resB.steps.length > 0) {
    const firstB = resB.steps[0];
    const lastA = combinedSteps[combinedSteps.length - 1];
    if (firstB && firstB.type === 'shop' && lastA && lastA.type === 'shop' && firstB.shop.id === lastA.shop.id) {
        combinedSteps = combinedSteps.concat(resB.steps.slice(1));
    } else {
        combinedSteps = combinedSteps.concat(resB.steps);
    }
}

console.log(`\nCombined multi-leg steps: total=${combinedSteps.length}`);
console.log('First 15 combined steps:');
combinedSteps.slice(0, 15).forEach((s, i) => {
    if (s.type === 'shop') console.log(`  ${i+1}. SHOP: ${s.shop.name} (id=${s.shop.id})`);
    else console.log(`  ${i+1}. STAIR: ${s.instruction}`);
});

console.log('\nTest completato');
