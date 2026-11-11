import { Router } from "express";
import fs from "node:fs";
import {
  generateReport,
  findReport,
  listReports
} from "../services/reportService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const force = req.body?.force === true;
    const days = req.body?.days ?? 7;
    const result = await generateReport({ force, days });
    const report = result.report;

    return res.status(result.created ? 201 : 200).json({
      message: result.created
        ? "Report generated successfully."
        : "A report has already been generated today. Returning the existing report.",
      id: report.id,
      created: result.created,
      file: `/reports/${report.id}/file`,
      report: {
        id: report.id,
        createdAt: report.created_at,
        reportDate: report.report_date,
        totalOrders: report.total_orders,
        totalRevenue: Number(report.total_revenue)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", (_req, res) => {
  res.json({ count: listReports().length, reports: listReports() });
});

router.get("/:id/file", (req, res) => {
  const report = findReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: "Report not found." });
  }
  if (!fs.existsSync(report.path)) {
    return res.status(404).json({ error: "The report record exists, but its PDF file is missing." });
  }
  return res.download(report.path, `sales-report-${report.report_date}.pdf`);
});

router.get("/:id", (req, res) => {
  const report = findReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: "Report not found." });
  }

  return res.json({
    id: report.id,
    createdAt: report.created_at,
    reportDate: report.report_date,
    totalOrders: report.total_orders,
    totalRevenue: Number(report.total_revenue),
    file: `/reports/${report.id}/file`
  });
});

export default router;
