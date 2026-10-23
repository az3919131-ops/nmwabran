/* يحمّل وحدات النواة في Node كما تُحمَّل في المتصفح */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', 'assets', 'js');
globalThis.window = undefined;
const cat = fs.readFileSync(path.join(root, 'catalog-data.js'), 'utf8');
vm.runInThisContext(cat.replace('window.MT_CATALOG', 'globalThis.MT_CATALOG'));
for (const f of ['core', 'compare', 'parsers', 'seed']) require(path.join(root, f + '.js'));
module.exports = globalThis.MT;
