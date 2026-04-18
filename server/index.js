// Server entry point — wired up in STEP 2.
// Intentionally minimal so `npm run dev` boots cleanly during scaffolding.
import http from "node:http";

const port = process.env.PORT || 5000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", message: "Server scaffold running. Implemented in STEP 2." }));
});

server.listen(port, () => {
  console.log(`[scaffold] Server listening on http://localhost:${port}`);
});
