const fs = require('node:fs');
const file = 'src/lib/performance.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }`,
  `        const shiftEntry = entry as unknown as { hadRecentInput: boolean; value: number };
        if (!shiftEntry.hadRecentInput) {
          clsValue += shiftEntry.value;
        }`,
);

fs.writeFileSync(file, code);
console.log('Fixed performance.ts');
