
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import passport from "./config/passport.js";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import roleAssignmentRoutes from "./routes/roleAssignmentRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";

const app = express();

// Passport
app.use(passport.initialize());

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SupportIQ API is running",
  });
});

// ============================================
// ROUTES
// ============================================

// Authentication routes FIRST
app.use("/api/auth", authRoutes);

// Organization routes
app.use("/api/organizations", organizationRoutes);

// RBAC routes
app.use("/api", roleRoutes);
app.use("/api", roleAssignmentRoutes);
app.use("/api", permissionRoutes);

export default app;
