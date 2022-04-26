import * as fs from "fs";
import * as filepath from "path";
import * as os from 'os';
import { Counters, makeCounters, sortKeys } from "./scanner";
import { Worker } from "worker_threads";

const merge = (dst: Counters, src: Counters) => {
  for (const section of Object.keys(dst)) {
    const d = dst[section as keyof Counters];
    const s = src[section as keyof Counters];
    for (const key of Object.keys(s)) {
      d[key] = (d[key] || 0) + s[key]
    }
  }
};

const main = async () => {
  let verbose = false;

  // simultaneous workers to start
  let count = os.cpus().length;

  // report progress every N scans
  const step = 100;

  // total scans completed
  let total = 0;

  // workers to launch
  const workers: Worker[] = [];

  // promises to receive final report from each worker
  const promises: Promise<Counters>[] = [];

  // start all workers
  for (let i = 0; i < count; i++) {

    const w = new Worker('./lib/worker.js');
    workers.push(w);

    promises.push(new Promise<Counters>((resolve, reject) => {
      w.on('message', (m) => {
        // when a scan completes, increment the counter and report it
        if (m.kind === 'scan') {
          if (verbose) {
            console.log(`[worker ${m.id}] ${m.path}`);
          }
          total++;
          if (total % step == 0) {
            console.log(`processed ${total}`);
          }

          // when a worker reports its counters, resolve the promise
        } else if (m.kind === 'report') {
          resolve(m.counters);
        }
      });

      // any error in a worker aborts
      w.on('error', (e) => {
        reject(e);
      });
    }));
  }
  let idx = 0;

  const counters = makeCounters();

  const args = process.argv.slice(2);
  for (const arg of args) {
    if (!fs.existsSync(arg)) {
      console.log(`[warning] path ${arg} does not exist, skipping`);
      continue;
    }

    const s = fs.statSync(arg);
    if (s.isFile()) {
      workers[idx % count].postMessage({ kind: 'scan', path: s });
      idx++;
      continue;
    }

    if (s.isDirectory()) {
      const names = fs.readdirSync(arg);
      console.log(`[info] scanning directory ${arg}`);

      for (const name of names) {
        workers[idx % count].postMessage({ kind: 'scan', path: filepath.join(arg, name) });
        idx++;
      }
    }
  }

  // trigger all workers to send their final report
  for (let i = 0; i < count; i++) {
    const w = workers[i];
    w.postMessage({ kind: 'report' });
  }

  // wait and merge all worker reports
  const results = await Promise.all(promises);
  for (const c of results) {
    merge(counters, c);
  }

  // write worker reports and exit
  for (const key of Object.keys(counters)) {
    fs.writeFileSync(key + ".json", JSON.stringify(sortKeys(counters[key as keyof Counters])));
  }
  for (const w of workers) {
    w.postMessage({ kind: 'exit' });
  }
};

main();
