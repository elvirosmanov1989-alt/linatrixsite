require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const initDb = require("./db/init");
const pool = require("./db/pool");

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const statsRoutes = require("./routes/stats");
const messageRoutes = require("./routes/messages");
const userRoutes = require("./routes/users");
const requestRoutes = require("./routes/requests");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, path: "/api/socket.io" });

app.set("io", io);
app.use(cors());
app.use(express.json());

app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.get("/readyz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).send("ready");
  } catch (err) {
    res.status(503).send("db not ready");
  }
});

app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);
app.use("/stats", statsRoutes);
app.use("/messages", messageRoutes);
app.use("/users", userRoutes);
app.use("/requests", requestRoutes);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;

async function start() {
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await initDb();
      break;
    } catch (err) {
      console.error(`DB init failed (attempt ${attempt}/${maxRetries}):`, err.message);
      if (attempt === maxRetries) process.exit(1);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  server.listen(PORT, () => {
    console.log(`Family Task App backend listening on port ${PORT}`);
  });
}

start();
