const express = require("express");
const cron = require("node-cron");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.post("/schedule", async (req, res) => {
  const { execute_at, webhook_url, payload } = req.body;

  await pool.query(
    `INSERT INTO reminders (id, execute_at, webhook_url, payload)
     VALUES ($1, $2, $3, $4)`,
    [uuidv4(), execute_at, webhook_url, payload]
  );

  res.json({ status: "scheduled" });
});

cron.schedule("* * * * *", async () => {
  const { rows } = await pool.query(
    `SELECT * FROM reminders
     WHERE execute_at <= NOW()
     AND status = 'pending'`
  );

  for (const reminder of rows) {
    try {
      await axios.post(reminder.webhook_url, reminder.payload);

      await pool.query(
        `UPDATE reminders SET status='executed' WHERE id=$1`,
        [reminder.id]
      );
    } catch (err) {
      console.error("Error ejecutando reminder:", err.message);
    }
  }
});

app.listen(3001, () => console.log("Scheduler running"));
