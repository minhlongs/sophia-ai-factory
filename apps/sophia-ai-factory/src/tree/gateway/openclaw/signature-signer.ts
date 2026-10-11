/**
 * Minimal p-limit: runs async tasks with a max concurrency cap.
 * Returns results in submission order (same as allSettled).
 */
export function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<PromiseSettledResult<T>>> {
  return new Promise((resolve) => {
    const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
    let next = 0;
    let completed = 0;

    function run(index: number): void {
      tasks[index]()
        .then((value) => {
          results[index] = { status: 'fulfilled', value };
        })
        .catch((reason: unknown) => {
          results[index] = { status: 'rejected', reason };
        })
        .finally(() => {
          completed++;
          if (completed === tasks.length) {
            resolve(results);
          } else if (next < tasks.length) {
            run(next++);
          }
        });
    }

    const initial = Math.min(concurrency, tasks.length);
    for (let i = 0; i < initial; i++) {
      run(next++);
    }
  });
}
