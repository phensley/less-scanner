import { parentPort, threadId } from 'worker_threads';
import { makeCounters, Scanner } from './scanner';

// Maintain counters across all scans in this worker
const counters = makeCounters();

const scanner = new Scanner(counters);

parentPort!.on('message', m => {
    switch (m.kind) {
        case 'scan':
            const res = scanner.scan(m.path);
            parentPort!.postMessage({ kind: 'scan', id: threadId, path: m.path });
            break;
        case 'report':
            parentPort!.postMessage({ kind: 'report', counters });
            break;
        case 'exit':
            process.exit();
    }
});
