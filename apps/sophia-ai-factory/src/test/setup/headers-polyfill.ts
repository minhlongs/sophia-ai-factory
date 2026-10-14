/**
 * Headers polyfill for jsdom environment to ensure spec compliance
 */

type HeaderInit = [string, string][] | Record<string, string> | Headers;

export class SpecCompliantHeaders {
  private _store = new Map<string, string[]>();

  constructor(init?: HeaderInit) {
    if (!init) return;
    if (Array.isArray(init)) {
      for (const [k, v] of init) this.append(k, v);
    } else if (init instanceof SpecCompliantHeaders) {
      init.forEach((v, k) => this.append(k, v));
    } else if (typeof init === 'object') {
      for (const [k, v] of Object.entries(init)) {
        if (Array.isArray(v)) {
          for (const val of v) this.append(k, val);
        } else {
          this.append(k, v);
        }
      }
    }
  }

  private normalize(name: string) {
    return name.toLowerCase();
  }

  append(name: string, value: string) {
    const key = this.normalize(name);
    const cur = this._store.get(key) ?? [];
    cur.push(value);
    this._store.set(key, cur);
  }

  set(name: string, value: string) {
    this._store.set(this.normalize(name), [value]);
  }

  get(name: string) {
    const cur = this._store.get(this.normalize(name));
    return cur ? cur[cur.length - 1] : null;
  }

  has(name: string) {
    return this._store.has(this.normalize(name));
  }

  delete(name: string) {
    return this._store.delete(this.normalize(name));
  }

  forEach(
    callback: (value: string, key: string, parent: Headers) => void,
    thisArg?: unknown
  ) {
    for (const [k, v] of this._store) {
      callback.call(thisArg, v[v.length - 1], k, this as unknown as Headers);
    }
  }

  keys() {
    const store = this._store;
    return {
      *[Symbol.iterator]() {
        for (const k of store.keys()) yield k;
      },
    };
  }

  values() {
    const store = this._store;
    return {
      *[Symbol.iterator]() {
        for (const v of store.values()) yield v[v.length - 1];
      },
    };
  }

  entries() {
    const store = this._store;
    return {
      *[Symbol.iterator]() {
        for (const [k, v] of store.entries()) yield [k, v[v.length - 1]];
      },
    };
  }

  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }

  get size() {
    return this._store.size;
  }

  getSetCookie(): string[] {
    return [];
  }
}

(globalThis as unknown as { Headers: typeof SpecCompliantHeaders }).Headers = SpecCompliantHeaders;
