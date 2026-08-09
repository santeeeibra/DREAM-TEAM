// PURA. Sin Phaser, sin Supabase, sin DOM.
// RNG determinista y serializable: toda la simulación depende sólo de la seed.

export function createRng(seed = 1) {
  let s = seed >>> 0;
  return {
    get state() { return s; },
    set state(v) { s = v >>> 0; },
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    // Sorteo ponderado por .peso
    weighted(items, weightOf = (x) => x.peso ?? 1) {
      const total = items.reduce((s2, it) => s2 + weightOf(it), 0);
      let r = this.next() * total;
      for (const it of items) {
        r -= weightOf(it);
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
    poisson(lambda) {
      const L = Math.exp(-lambda);
      let k = 0, p = 1;
      do { k++; p *= this.next(); } while (p > L && k < 12);
      return k - 1;
    },
  };
}
