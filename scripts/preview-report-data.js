import { getReportData } from "../src/services/reportService.js";
import { db } from "../src/db/database.js";

try {
  const count = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  if (count === 0) {
    console.error("No orders found. Run npm run seed first.");
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(getReportData(), null, 2));
  }
} finally {
  db.close();
}
