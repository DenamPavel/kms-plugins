// Cache module — intentionally undocumented in the draft
// This subsystem is part of the actual machinery but omitted from draft.md
// The internals critic should flag this when comparing source to draft.

export class CacheManager {
  constructor() {
    this.store = new Map();
    this.ttl = new Map();
  }

  set(key, value, ttlSeconds = 300) {
    this.store.set(key, value);
    if (ttlSeconds > 0) {
      this.ttl.set(key, Date.now() + ttlSeconds * 1000);
    }
  }

  get(key) {
    const ttlTime = this.ttl.get(key);
    if (ttlTime && Date.now() > ttlTime) {
      this.store.delete(key);
      this.ttl.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  invalidate(key) {
    this.store.delete(key);
    this.ttl.delete(key);
  }
}
