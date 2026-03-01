const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const session = require("express-session");
const flash = require("connect-flash");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");
const http = require("http");
const socketIO = require("socket.io");

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require("./config/database");

// Import routes
const authRoutes = require("./routes/auth");
const citizenRoutes = require("./routes/citizen");
const authorityRoutes = require("./routes/authority");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const mapRoutes = require("./routes/map");
const aiRoutes = require("./routes/ai");
const voiceRoutes = require("./routes/voice");
// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Make io accessible to routes
app.set("io", io);

// Connect to MongoDB
connectDB();

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
// Middleware - Increased limit for audio files
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(methodOverride("_method"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Flash messages
app.use(flash());

// Global variables for views
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.user || null;
  next();
});

// Routes
app.use("/", publicRoutes);
app.use("/auth", authRoutes);
app.use("/citizen", citizenRoutes);
app.use("/authority", authorityRoutes);
app.use("/admin", adminRoutes);
app.use("/map", mapRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/voice", voiceRoutes);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  // User joins with their role and ID
  socket.on("join", (data) => {
    const { userId, role } = data;
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);
    console.log(`✅ User ${userId} (${role}) joined`);
  });

  // User disconnects
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// 404 Error handler
app.use((req, res, next) => {
  res.status(404).render("error", {
    title: "404 - Page Not Found",
    message: "The page you are looking for does not exist.",
    error: { status: 404 },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);

  res.status(err.status || 500).render("error", {
    title: "Error",
    message: err.message || "Something went wrong",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║   🏛️  CivicTrack Platform Started          ║
║                                            ║
║   🌐 Server: http://localhost:${PORT}      ║
║   📊 Environment: ${process.env.NODE_ENV || "development"}           ║
║   🗄️  Database: Connected                  ║
║   🔔 WebSockets: Active                    ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});
