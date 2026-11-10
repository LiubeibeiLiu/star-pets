export function serialQueue() {
  let tail = Promise.resolve();
  /** @template T @param {()=>T|Promise<T>} task @returns {Promise<T>} */
  function enqueue(task) {
    const result = tail.then(task);
    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  return enqueue;
}
