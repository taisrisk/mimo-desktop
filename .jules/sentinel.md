## 2025-03-05 - Fix stack trace leakage to client
**Vulnerability:** Found `packages/opencode/src/server/middleware.ts` returning raw internal stack traces in the 500 error response payload for internal exceptions.
**Learning:** Returning `err.stack` inside HTTP responses exposes underlying file system structure, node versions, and potential internal paths, making recon easier for attackers.
**Prevention:** Catch unhandled exceptions correctly, log `err.stack` strictly on the server-side, and only send generic or formatted user-facing messages `err.message` down to the client.
