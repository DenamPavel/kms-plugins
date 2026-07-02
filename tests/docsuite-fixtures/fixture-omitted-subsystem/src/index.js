// Entry point for the app
import { DataStore } from './data-store.js';
import { ReportGenerator } from './reporting.js';
import { CacheManager } from './cache.js';

async function main() {
  const store = new DataStore();
  const reporter = new ReportGenerator(store);
  const cache = new CacheManager();

  console.log('App initialized with data store, reporting, and cache');
  const data = await store.fetch();
  const cached = cache.get('key');
  const report = reporter.generate();

  console.log('Done');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
