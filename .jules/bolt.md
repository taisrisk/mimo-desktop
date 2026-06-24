## 2025-05-18 - Optimized FileTree filtering logic
**Learning:** SolidJS `createMemo` dependencies can become bottlenecks for UI components with a lot of entries. `file-tree.tsx` was doing O(n*m) (splitting, slicing, and joining arrays for every path element) array operations.
**Action:** Instead of `split("/")` and arrays, use standard string operations like `lastIndexOf("/")` and early returns `if (dirs.has(current)) break` when crawling backward up the path to improve parsing logic speed.
## 2026-06-16 - Prevent uncleaned interval memory leak
**Learning:** In SolidJS, `setInterval` must be cleaned up manually, otherwise it will run indefinitely and compound on every mount, leading to CPU drain and memory leaks. `onMount` and `onCleanup` are needed to handle lifecycle properly.
**Action:** Use `onCleanup(() => clearInterval(interval))` for any intervals created inside components.
