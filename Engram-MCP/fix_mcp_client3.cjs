const fs = require('fs');
const file = 'src/client.ts';
let code = fs.readFileSync(file, 'utf8');

// The previous attempt inserted runDecay right into the middle of cleanupExpired.
// Let's clean it up properly.
const cleanMethod = `        async cleanupExpired(params: { tenant_id?: string }): Promise<{ removed: number }> {
                const response = await resilientFetch(\`\${this.baseUrl}/memories/cleanup\`, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify(params),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ removed: number }>(response);
        }

        async runDecay(params: { tenant_id?: string }): Promise<{ processed: number }> {
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

// Find cleanupExpired signature
const startIdx = code.indexOf('async cleanupExpired');
// Find addEntity signature (the next method)
const endIdx = code.indexOf('async addEntity');

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + cleanMethod + "\n\n        " + code.substring(endIdx);
    fs.writeFileSync(file, code);
    console.log('Fixed client.ts cleanly');
} else {
    console.log('Could not find boundaries');
}
