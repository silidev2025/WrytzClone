/** Bound database fan-out while preserving list order. Intended for independent reads. */
export async function mapConcurrent<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 4): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, async () => {
    for (let index = next++; index < items.length; index = next++) results[index] = await fn(items[index]);
  }));
  return results;
}
