import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import passport from "./config/passport.js";
import organizationRoutes from "./routes/organizationRoutes.js";

const app = express();

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

app.use("/api/organizations", organizationRoutes);

app.use("/api/auth", authRoutes);

export default app;