// Deliberately broken evaluation fixture. Do not fix this baseline.
export function mergeIntervals(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const result = [intervals[0]];
  for (const next of intervals.slice(1)) {
    const last = result[result.length - 1];
    if (next[0] <= last[1]) last[1] = Math.max(last[1], next[1]);
    else result.push(next);
  }
  return result;
}
