# Repair mergeIntervals

Fix `intervals.mjs`. Input is an array of finite numeric pairs `[start, end]` with `start < end`.
Return sorted, merged half-open ranges. Merge actual overlaps, including nested and transitive overlaps.
Touching ranges, such as `[1, 2]` and `[2, 3]`, must remain separate.
Empty input returns `[]`. Do not mutate any input array or pair.
No dependencies are needed. Keep the exported function name and input/output shape.

Example: `[[4, 6], [1, 3], [2, 4]]` becomes `[[1, 4], [4, 6]]`.
