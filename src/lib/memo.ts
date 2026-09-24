// Tiny reference-keyed cache for pure functions over the DemoDatabase.
// Results are cached per (object references…, string key) and dropped automatically when any
// of the referenced arrays is replaced by a store write (WeakMap keys).

type Node = { map: WeakMap<object, Node>; values?: Map<string, unknown> };
const root: Node = { map: new WeakMap() };

export function memoOn<T>(refs: readonly object[], key: string, compute: () => T): T {
  let node = root;
  for (const r of refs) {
    let next = node.map.get(r);
    if (!next) {
      next = { map: new WeakMap() };
      node.map.set(r, next);
    }
    node = next;
  }
  node.values ??= new Map();
  if (node.values.has(key)) return node.values.get(key) as T;
  const v = compute();
  node.values.set(key, v);
  return v;
}
