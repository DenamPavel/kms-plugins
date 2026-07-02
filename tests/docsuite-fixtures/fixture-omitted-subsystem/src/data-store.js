// Data store module
export class DataStore {
  constructor() {
    this.data = [];
  }

  async fetch() {
    return Promise.resolve(this.data);
  }

  async save(record) {
    this.data.push(record);
  }
}
