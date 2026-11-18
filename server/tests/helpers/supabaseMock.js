const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "eq",
  "order",
  "limit",
  "or",
  "gte",
  "lte",
];

function makeBuilder(result) {
  const builder = {};

  CHAIN_METHODS.forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });

  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);

  return builder;
}

// Returns a jest.fn() to use as supabase.from(). Each call consumes the next
// { data, error } result from the queue, in the same order the controller
// under test calls supabase.from(...).
function makeSupabaseFrom(resultsQueue) {
  const queue = [...resultsQueue];

  return jest.fn(() => {
    if (queue.length === 0) {
      throw new Error("No more mock results queued for supabase.from()");
    }
    return makeBuilder(queue.shift());
  });
}

module.exports = { makeSupabaseFrom };
