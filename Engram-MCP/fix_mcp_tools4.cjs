const fs = require('fs');
const file = 'src/tools/memory-tools.ts';
let code = fs.readFileSync(file, 'utf8');

// There is a malformed block at the end where cleanupExpired got mangled during previous fixes.
// We need to fix the case statement.
code = code.replace(/const input = validate\(CleanupExpiredSchema, args\);\n\s*const result = await client\.cleanupExpired/,
`                case "cleanup_expired": {
                        const input = validate(CleanupExpiredSchema, args);
                        const result = await client.cleanupExpired`);

fs.writeFileSync(file, code);
console.log('Fixed memory-tools syntax error');
