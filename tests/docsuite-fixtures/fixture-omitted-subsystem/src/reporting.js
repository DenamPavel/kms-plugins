// Reporting module — depends on data-store
export class ReportGenerator {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  generate() {
    return {
      title: 'Report',
      timestamp: new Date().toISOString(),
    };
  }
}
