import { db, closeDatabase } from "../src/db/database.js";

const products = [
  "Wireless Mouse",
  "Mechanical Keyboard",
  "USB-C Hub",
  "Laptop Stand",
  "Webcam HD",
  "Bluetooth Speaker"
];

const customers = [
  "Ayesha Khan", "Ali Raza", "Sara Ahmed", "Usman Malik",
  "Hina Shah", "Bilal Hussain", "Zara Iqbal", "Hamza Sheikh",
  "Noor Fatima", "Danish Ali", "Mariam Qureshi", "Saad Ahmed"
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinLast30Days() {
  const now = new Date();
  const daysAgo = randomInt(0, 29);
  const date = new Date(now);
  date.setDate(now.getDate() - daysAgo);
  date.setHours(randomInt(8, 20), randomInt(0, 59), randomInt(0, 59), 0);
  return date.toISOString();
}

try {
  // Clear the existing sample rows so this script is safe to run repeatedly.
  db.exec("DELETE FROM orders");

  const insert = db.prepare(`
    INSERT INTO orders (customer, product, amount, created_at)
    VALUES (?, ?, ?, ?)
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (let i = 0; i < 200; i += 1) {
      insert.run(
        customers[randomInt(0, customers.length - 1)],
        products[randomInt(0, products.length - 1)],
        Number((Math.random() * 195 + 5).toFixed(2)),
        randomDateWithinLast30Days()
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const result = db.prepare("SELECT COUNT(*) AS count FROM orders").get();
  console.log(`Seed complete. Orders in database: ${result.count}`);
  console.log("Run npm run seed again: the count will remain 200.");
} catch (error) {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
} finally {
  closeDatabase();
}
