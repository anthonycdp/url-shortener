export class MockRedis {
  private data: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();
  private lists: Map<string, string[]> = new Map();

  async get(key: string): Promise<string | null> {
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.data.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.data.get(key) || null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.data.set(key, value);
    return "OK";
  }

  async setex(key: string, seconds: number, value: string): Promise<"OK"> {
    this.data.set(key, value);
    this.expirations.set(key, Date.now() + seconds * 1000);
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    this.expirations.delete(key);
    this.lists.delete(key);
    return existed ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const current = parseInt(this.data.get(key) || "0", 10);
    const next = current + 1;
    this.data.set(key, next.toString());
    return next;
  }

  async pexpire(key: string, ms: number): Promise<number> {
    if (!this.data.has(key)) return 0;
    this.expirations.set(key, Date.now() + ms);
    return 1;
  }

  async pttl(key: string): Promise<number> {
    const expiration = this.expirations.get(key);
    if (!expiration) return -1;
    const remaining = expiration - Date.now();
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.pexpire(key, seconds * 1000);
  }

  async lpush(key: string, value: string): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.unshift(value);
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<"OK"> {
    if (this.lists.has(key)) {
      const list = this.lists.get(key)!;
      this.lists.set(key, list.slice(start, stop + 1));
    }
    return "OK";
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.lists.has(key)) return [];
    const list = this.lists.get(key)!;
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async ping(): Promise<"PONG"> {
    return "PONG";
  }

  async quit(): Promise<"OK"> {
    return "OK";
  }

  // Helper for testing
  clear(): void {
    this.data.clear();
    this.expirations.clear();
    this.lists.clear();
  }
}

export const mockRedis = new MockRedis();
