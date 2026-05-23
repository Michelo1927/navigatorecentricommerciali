const fs = require('fs');
const vm = require('vm');

function check(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    new vm.Script(code, { filename: filePath });
    console.log(`${filePath}: OK`);
  } catch (e) {
    console.error(`${filePath}: SYNTAX ERROR`);
    console.error(e.stack || e.toString());
    process.exitCode = 2;
  }
}

['../app.js','../navigation.js','../data.js'].forEach(p => check(__dirname + '/' + p));
