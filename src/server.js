import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import reportRoutes from "./routes/reportRoutes.js";
import { db } from "./db/database.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.type("html").send(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>PDF Report Generator</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:760px;margin:60px auto;padding:0 20px;color:#172033}
        h1{color:#1d4ed8}code{background:#eef2ff;padding:3px 6px;border-radius:4px}
        a{color:#1d4ed8}
      </style></head>
      <body>
        <h1>PDF Report Generator</h1>
        <p>Generate sales reports from SQLite data and download the PDF by link.</p>
        <ul>
          <li><code>GET /health</code> — health check</li>
          <li><code>POST /reports</code> — generate today's report</li>
          <li><code>GET /reports</code> — list generated reports</li>
        </ul>
        <p>See <a href="https://github.com/">the project README</a> for API examples.</p>
      </body>
    </html>
  `);
});

app.use("/reports", reportRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "An unexpected server error occurred.",
    message: process.env.NODE_ENV === "production" ? undefined : error.message
  });
});

const server = app.listen(PORT, () => {
  console.log(`PDF Report Generator running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

function shutdown() {
  server.close(() => {
    try { db.close(); } catch {}
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
