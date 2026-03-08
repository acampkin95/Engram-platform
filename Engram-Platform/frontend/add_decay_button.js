const fs = require('node:fs');
const file = 'app/dashboard/memory/memories/MemoriesContent.tsx';
let code = fs.readFileSync(file, 'utf8');

const actions = `        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={async () => {
              try {
                await memoryClient.runDecay();
                addToast({ type: 'success', message: 'Memory decay process started' });
              } catch (e) {
                addToast({ type: 'error', message: 'Failed to start decay process' });
              }
            }}>
              Run Decay
            </Button>
            <Button variant="secondary" onClick={async () => {
              try {
                await memoryClient.consolidateMemories();
                addToast({ type: 'success', message: 'Memory consolidation started' });
              } catch (e) {
                addToast({ type: 'error', message: 'Failed to start consolidation' });
              }
            }}>
              Consolidate
            </Button>
            <Button onClick={() => setShowAddModal(true)}>Add Memory</Button>
          </div>
        }`;

code = code.replace(
  / {8}action={<Button onClick={\(\) => setShowAddModal\(true\)}>Add Memory<\/Button>}/,
  actions,
);
fs.writeFileSync(file, code);
console.log('Added decay and consolidate buttons to MemoriesContent.tsx');
