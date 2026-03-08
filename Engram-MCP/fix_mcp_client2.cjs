const fs = require('fs');
const file = 'src/client.ts';
let code = fs.readFileSync(file, 'utf8');

const newMethod = `        async runDecay(params: { tenant_id?: string }): Promise<{ processed: number }> {
                const response = await resilientFetch(\`\${this.baseUrl}/memories/decay\`, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify(params),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ processed: number }>(response);
        }`;

if (!code.includes("runDecay")) {
    const lines = code.split('\n');
    const idx = lines.findIndex(l => l.includes('async cleanupExpired'));

    if (idx !== -1) {
        // Find the end of cleanupExpired method
        let endIdx = idx;
        let braceCount = 0;
        let started = false;

        for (let i = idx; i < lines.length; i++) {
            if (lines[i].includes('{')) {
                braceCount++;
                started = true;
            }
            if (lines[i].includes('}')) {
                braceCount--;
            }
            if (started && braceCount === 0) {
                endIdx = i;
                break;
            }
        }

        lines.splice(endIdx + 1, 0, '\n' + newMethod);
        fs.writeFileSync(file, lines.join('\n'));
        console.log('Fixed client.ts');
    } else {
        console.log('Could not find cleanupExpired in client.ts');
    }
} else {
    console.log('Already fixed client.ts');
}
