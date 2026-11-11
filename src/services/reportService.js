import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { db } from "../db/database.js";

const reportsDir = path.resolve(process.env.REPORTS_DIR || "./reports");
fs.mkdirSync(reportsDir, { recursive: true });

const money = (value) => Number(Number(value || 0).toFixed(2));

export function getReportData({ days = 7 } = {}) {
  const safeDays = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 90);

  const totals = db.prepare(`
    SELECT COUNT(*) AS totalOrders,
           COALESCE(SUM(amount), 0) AS totalRevenue,
           COALESCE(AVG(amount), 0) AS averageOrderValue
    FROM orders
  `).get();

  const topProducts = db.prepare(`
    SELECT product,
           COUNT(*) AS orderCount,
           ROUND(SUM(amount), 2) AS revenue
    FROM orders
    GROUP BY product
    ORDER BY revenue DESC
    LIMIT 5
  `).all();

  const ordersPerDay = db.prepare(`
    SELECT date(created_at) AS day,
           COUNT(*) AS orderCount,
           ROUND(SUM(amount), 2) AS revenue
    FROM orders
    WHERE date(created_at) >= date('now', ?)
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(`-${safeDays - 1} days`);

  const allOrders = db.prepare(`
    SELECT id, customer, product, amount, created_at
    FROM orders
    ORDER BY datetime(created_at) DESC, id DESC
  `).all();

  return {
    generatedAt: new Date().toISOString(),
    periodDays: safeDays,
    totals: {
      totalOrders: Number(totals.totalOrders),
      totalRevenue: money(totals.totalRevenue),
      averageOrderValue: money(totals.averageOrderValue)
    },
    topProducts: topProducts.map((row) => ({
      product: row.product,
      orderCount: Number(row.orderCount),
      revenue: money(row.revenue)
    })),
    ordersPerDay: ordersPerDay.map((row) => ({
      day: row.day,
      orderCount: Number(row.orderCount),
      revenue: money(row.revenue)
    })),
    allOrders: allOrders.map((row) => ({
      id: Number(row.id),
      customer: row.customer,
      product: row.product,
      amount: money(row.amount),
      createdAt: row.created_at
    }))
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
  return `Rs. ${Number(value).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function buildReportHtml(report) {
  const topRows = report.topProducts.map((item) => `
    <tr>
      <td>${escapeHtml(item.product)}</td>
      <td class="number">${item.orderCount}</td>
      <td class="number">${formatCurrency(item.revenue)}</td>
    </tr>
  `).join("");

  const dailyRows = report.ordersPerDay.length
    ? report.ordersPerDay.map((item) => `
      <tr>
        <td>${escapeHtml(item.day)}</td>
        <td class="number">${item.orderCount}</td>
        <td class="number">${formatCurrency(item.revenue)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" class="empty">No orders found in this period.</td></tr>`;

  const orderRows = report.allOrders.map((item) => `
    <tr>
      <td>${item.id}</td>
      <td>${escapeHtml(item.customer)}</td>
      <td>${escapeHtml(item.product)}</td>
      <td class="number">${formatCurrency(item.amount)}</td>
      <td>${escapeHtml(new Date(item.createdAt).toLocaleString("en-GB"))}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales Report</title>
  <style>
    @page { size: A4; margin: 18mm 14mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #172033; font-size: 10px; }
    .brand { color: #2563eb; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
    h1 { font-size: 25px; margin: 8px 0 5px; color: #111827; }
    .muted { color: #64748b; }
    .topline { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 14px; }
    .cards { display: flex; gap: 12px; margin: 20px 0; }
    .card { flex: 1; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 7px; padding: 12px; }
    .card-label { color: #64748b; font-size: 9px; text-transform: uppercase; }
    .card-value { font-size: 17px; font-weight: 700; margin-top: 6px; color: #0f172a; }
    h2 { font-size: 14px; margin: 20px 0 8px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th { background: #1e3a8a; color: white; text-align: left; font-size: 9px; }
    th, td { padding: 7px 6px; border: 1px solid #dbe2ea; vertical-align: top; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .number { text-align: right; white-space: nowrap; }
    .empty { text-align: center; color: #64748b; }
    .footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; color: #64748b; font-size: 8px; }
  </style>
</head>
<body>
  <div class="topline">
    <div>
      <div class="brand">FLYRANK · REPORTING</div>
      <h1>Sales Report</h1>
      <div class="muted">Order performance and product revenue summary</div>
    </div>
    <div class="muted">Generated: ${escapeHtml(new Date(report.generatedAt).toLocaleString("en-GB"))}</div>
  </div>

  <div class="cards">
    <div class="card"><div class="card-label">Total orders</div><div class="card-value">${report.totals.totalOrders}</div></div>
    <div class="card"><div class="card-label">Total revenue</div><div class="card-value">${formatCurrency(report.totals.totalRevenue)}</div></div>
    <div class="card"><div class="card-label">Average order</div><div class="card-value">${formatCurrency(report.totals.averageOrderValue)}</div></div>
  </div>

  <h2>Top 5 Products by Revenue</h2>
  <table>
    <thead><tr><th>Product</th><th class="number">Orders</th><th class="number">Revenue</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>

  <h2>Orders per Day — Last ${report.periodDays} Days</h2>
  <table>
    <thead><tr><th>Date</th><th class="number">Orders</th><th class="number">Revenue</th></tr></thead>
    <tbody>${dailyRows}</tbody>
  </table>

  <h2>Complete Order Details (${report.allOrders.length} records)</h2>
  <table>
    <thead><tr><th>ID</th><th>Customer</th><th>Product</th><th class="number">Amount</th><th>Created at</th></tr></thead>
    <tbody>${orderRows}</tbody>
  </table>

  <div class="footer">Confidential · Generated automatically by the FlyRank PDF Report Generator</div>
</body>
</html>`;
}

export async function renderPdf(report, destination) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ format: "A4" });
    await page.setContent(buildReportHtml(report), { waitUntil: "load" });
    await page.pdf({
      path: destination,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#64748b;padding:0 14mm;text-align:right">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
      margin: { top: "18mm", right: "14mm", bottom: "22mm", left: "14mm" }
    });
  } finally {
    await browser.close();
  }
}

function todayLocalDate() {
  // The assignment uses the server's calendar day for the once-per-day rule.
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function generateReport({ force = false, days = 7 } = {}) {
  const reportDate = todayLocalDate();

  if (!force) {
    const existing = db.prepare(`
      SELECT id, path, created_at, report_date, total_orders, total_revenue
      FROM reports
      WHERE report_date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(reportDate);

    if (existing) {
      return { created: false, report: existing };
    }
  }

  const id = randomUUID();
  const fileName = `sales-report-${reportDate}-${id}.pdf`;
  const absolutePath = path.join(reportsDir, fileName);
  const reportData = getReportData({ days });

  await renderPdf(reportData, absolutePath);

  try {
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO reports (id, path, created_at, report_date, total_orders, total_revenue)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      absolutePath,
      createdAt,
      reportDate,
      reportData.totals.totalOrders,
      reportData.totals.totalRevenue
    );
  } catch (error) {
    fs.rmSync(absolutePath, { force: true });
    throw error;
  }

  return {
    created: true,
    report: db.prepare(`
      SELECT id, path, created_at, report_date, total_orders, total_revenue
      FROM reports WHERE id = ?
    `).get(id)
  };
}

export function findReport(id) {
  return db.prepare(`
    SELECT id, path, created_at, report_date, total_orders, total_revenue
    FROM reports WHERE id = ?
  `).get(id);
}

export function listReports() {
  return db.prepare(`
    SELECT id, created_at, report_date, total_orders, total_revenue,
           '/reports/' || id || '/file' AS file
    FROM reports ORDER BY created_at DESC
  `).all();
}

export function getReportsDirectory() {
  return reportsDir;
}
