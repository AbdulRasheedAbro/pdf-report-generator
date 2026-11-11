# PDF Report Generator — FlyRank Internship A8

A Node.js backend application that queries order data from SQLite, aggregates it with SQL, renders a multi-page PDF using HTML + Playwright/Chromium, stores the PDF on disk, and serves it through a download link.

## Technology stack

- Node.js 22+
- Express 5
- SQLite using Node's built-in `node:sqlite` module
- Playwright with Chromium
- HTML and CSS print styles
- Git and GitHub

> This project follows the JavaScript lane in the supplied A8 assignment. Background jobs are not required for the core assignment; the report is generated inside `POST /reports`.

## Features

- Creates a local SQLite database and the `orders` and `reports` tables.
- Seeds 200 sample shop orders across six products.
- Seed script is repeatable: it clears the previous sample rows before inserting exactly 200.
- SQL aggregation: total order count, total revenue, top five products by revenue, and daily order totals.
- HTML-to-PDF rendering with headless Chromium.
- A4 PDF with print backgrounds, repeating table headers, and rows protected from page splitting.
- `POST /reports` generates and stores a PDF, then returns its ID and file URL.
- `GET /reports/:id` returns report metadata.
- `GET /reports/:id/file` downloads the stored PDF.
- Same-day idempotency: repeated POST requests reuse the existing report unless `{"force": true}` is supplied.
- `GET /reports` lists generated reports.
- Optional `days` parameter (1–90) controls the daily aggregation window.

## Requirements

- Node.js 22 or later.
- npm.
- Internet access for the first dependency and Chromium installation.

Node 22's built-in SQLite module is experimental in some Node 22 releases. Use a recent Node 22 release and expect an experimental warning from Node.

## Setup

```bash
npm install
npx playwright install chromium
```

If Chromium dependencies are missing on Linux, run:

```bash
npx playwright install --with-deps chromium
```

## Run the application

Terminal 1 — seed the database:

```bash
npm run seed
```

Terminal 2 — start the API:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Health check:

```bash
curl -i http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

## Generate and download a report

Generate today's report:

```bash
curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -d "{}"
```

Expected response shape (the ID is generated at runtime):

```json
{
  "message": "Report generated successfully.",
  "id": "generated-uuid",
  "created": true,
  "file": "/reports/generated-uuid/file",
  "report": {
    "id": "generated-uuid",
    "createdAt": "generated-timestamp",
    "reportDate": "today",
    "totalOrders": 200,
    "totalRevenue": 12345.67
  }
}
```

Download the PDF (replace the ID):

```bash
curl -L -o my-report.pdf http://localhost:3000/reports/REPORT_ID/file
```

Open `my-report.pdf` in a PDF viewer. The full order table is deliberately long so the PDF should span multiple A4 pages.

Get report metadata:

```bash
curl -i http://localhost:3000/reports/REPORT_ID
```

List all generated reports:

```bash
curl -i http://localhost:3000/reports
```

## Idempotency proof

Send the same request twice on the same server calendar day:

```bash
curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" -d "{}"

curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" -d "{}"
```

The first request should return `201 Created`. The second should return `200 OK`, with the same report ID and file link. Only one report file is created for the day.

To intentionally create a new report:

```bash
curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -d "{\"force\": true}"
```

The `force` option bypasses the once-per-day reuse check.

## Parameterized report

Request the daily breakdown for the last 14 days:

```bash
curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -d "{\"force\": true, \"days\": 14}"
```

The `days` value is bounded between 1 and 90.

## Aggregation SQL

**1. Overall totals**

```sql
SELECT COUNT(*) AS totalOrders,
       COALESCE(SUM(amount), 0) AS totalRevenue,
       COALESCE(AVG(amount), 0) AS averageOrderValue
FROM orders;
```

**2. Top five products by revenue**

```sql
SELECT product,
       COUNT(*) AS orderCount,
       ROUND(SUM(amount), 2) AS revenue
FROM orders
GROUP BY product
ORDER BY revenue DESC
LIMIT 5;
```

**3. Orders and revenue per day**

```sql
SELECT date(created_at) AS day,
       COUNT(*) AS orderCount,
       ROUND(SUM(amount), 2) AS revenue
FROM orders
WHERE date(created_at) >= date('now', '-6 days')
GROUP BY date(created_at)
ORDER BY day ASC;
```

**4. Full order list for the PDF**

```sql
SELECT id, customer, product, amount, created_at
FROM orders
ORDER BY datetime(created_at) DESC, id DESC;
```

## Pipeline

```text
POST /reports
     |
     v
Check today's report (idempotency)
     |
     +---- Existing report and force=false ----> Return existing ID + link (200)
     |
     v
Query SQLite and aggregate data
     |
     v
Build HTML report
     |
     v
Playwright / Chromium prints A4 PDF
     |
     v
Save PDF in reports/
     |
     v
Insert report metadata in SQLite
     |
     v
Return 201 + report ID + file link
     |
     v
GET /reports/:id/file streams the file from disk
```

## Stage 4 — when should this move out of the request?

The report generation should move to a background job when PDF generation takes long enough to risk request timeouts, when reports become substantially larger, or when many users request reports concurrently. The API could then return `202 Accepted` and a job/report ID immediately while a worker generates the PDF.

## Stage 5 — idempotency

The once-per-day check prevents duplicate PDF generation when a user double-clicks the generate button or retries after a slow response. A similar missing check in a payment or email workflow could charge a customer twice or send the same customer multiple messages.

## Stage 6 — publishing and artifacts

The SQLite database and generated PDF files are intentionally excluded from Git. The seed script is the reproducible recipe for rebuilding the development data. Generated reports are stored on disk and API responses contain only metadata and a link; PDF bytes are transferred only by the file-download endpoint.

Before publishing, generate a PDF locally and add a screenshot of page one to `docs/report-preview.png`. This screenshot is intentionally not fabricated in the source package.

## Stretch goals

- **A7 background job:** move query → render → save into a worker and return `202 Accepted` with a pending report ID. The user does not wait for Chromium, but the system needs job status, failure handling, and worker operations.
- **Scheduled report:** run every Monday at 08:00 using a scheduler or an A7-compatible scheduled function. Cron expression: `0 8 * * 1`. If the server is down at 08:00, an in-process scheduler may miss that run unless it has persistent scheduling or catch-up logic.
- **Email:** send a report URL rather than attaching the PDF. Links avoid copying large attachments into every email and allow the file to be managed centrally.

## Validation checklist

- [ ] `GET /health` returns HTTP 200.
- [ ] `npm run seed` prints exactly 200 orders, even when run twice.
- [ ] `npm run report:data` prints four report sections as JSON.
- [ ] `POST /reports` returns HTTP 201 and a file link.
- [ ] The downloaded PDF opens and contains multiple pages.
- [ ] The table header repeats and table rows are not split across pages.
- [ ] `GET /reports/:id` returns metadata; an unknown ID returns 404.
- [ ] `GET /reports/:id/file` downloads the PDF.
- [ ] Two same-day POST requests return the same ID; only one report is generated.
- [ ] `force: true` creates a new report.
- [ ] Add a real PDF preview screenshot to `docs/report-preview.png`.
- [ ] Publish the repository with at least seven meaningful commits.

## Suggested seven-stage Git history

Create a commit after each stage as you complete and test it:

1. `Stage 0: setup Express server and Playwright`
2. `Stage 1: create SQLite schema and repeatable seed`
3. `Stage 2: implement SQL report aggregations`
4. `Stage 3: render HTML reports to PDF`
5. `Stage 4: add report API and file download`
6. `Stage 5: enforce same-day idempotency`
7. `Stage 6: document and publish report generator`

Do not create these commits as a fake history after the fact; commit each completed stage as you work.

## Project structure

```text
pdf-report-generator/
├── docs/
├── reports/
│   └── .gitkeep
├── scripts/
│   ├── preview-report-data.js
│   └── seed.js
├── src/
│   ├── db/
│   │   └── database.js
│   ├── routes/
│   │   └── reportRoutes.js
│   ├── services/
│   │   └── reportService.js
│   └── server.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Important implementation note

The same-day idempotency logic is designed for the assignment's single-process local server. A production deployment with multiple server instances should enforce uniqueness transactionally in the database and coordinate concurrent generation requests with a lock or job record.
