## 2025-05-18 - Optimized FileTree filtering logic
**Learning:** SolidJS `createMemo` dependencies can become bottlenecks for UI components with a lot of entries. `file-tree.tsx` was doing O(n*m) (splitting, slicing, and joining arrays for every path element) array operations.
**Action:** Instead of `split("/")` and arrays, use standard string operations like `lastIndexOf("/")` and early returns `if (dirs.has(current)) break` when crawling backward up the path to improve parsing logic speed.
