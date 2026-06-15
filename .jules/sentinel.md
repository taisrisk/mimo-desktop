## 2025-06-15 - Prevent Stack Trace Leakage
**Vulnerability:** The error handling middleware in the server was leaking internal server stack traces (`err.stack`) to clients when an unhandled error occurred (HTTP 500).
**Learning:** Returning `error.stack` or raw string representations directly in an API response can unintentionally expose the internal application structure or dependencies to an attacker, which violates defense-in-depth principles.
**Prevention:** Ensure that global or route-specific error handlers serialize only safe, generic error messages (e.g., `error.message` or a static string) in production, logging the full stack trace internally instead.
