
import express from "express";
import passport from "../config/passport.js";
import { changePassword, forgotPassword, getCurrentUser, loginUser, logoutAllDevices, logoutUser, registerUser, resetPassword, verifyEmail,refreshAccessToken,
    googleAuthCallback , getActiveSessions,revokeSession} from "../controllers/authController.js";
import validateMiddleware from "../middleware/validateMiddleware.js";
import { registerSchema,loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, verifyEmailSchema } from "../validators/authValidator.js";
import authMiddleware from "../middleware/authMiddleware.js";


const router = express.Router();

// User registration
router.post(
    "/register",
    validateMiddleware(registerSchema),
    registerUser
);
// Login
router.post(
    "/login",
    validateMiddleware(loginSchema),
    loginUser
);
// Get authenticated user profile
router.get("/me", authMiddleware, getCurrentUser);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);
router.post(
    "/logout-all",
    authMiddleware,
    logoutAllDevices
);

router.post(
    "/forgot-password",
    validateMiddleware(forgotPasswordSchema),
    forgotPassword
);

router.post(
    "/reset-password",
    validateMiddleware(resetPasswordSchema),
    resetPassword
);

router.patch(
    "/change-password",
    authMiddleware,
    validateMiddleware(changePasswordSchema),
    changePassword
);

router.post(
    "/verify-email",
    validateMiddleware(verifyEmailSchema),
    verifyEmail
);

// Get all active login sessions
router.get(
    "/sessions",
    authMiddleware,
    getActiveSessions
);

// Revoke a specific login session
router.delete(
    "/sessions/:sessionId",
    authMiddleware,
    revokeSession
);

// Start Google OAuth
router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
    })
);

// Google OAuth callback
router.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: "/api/auth/google/failure",
    }),
    googleAuthCallback
);

router.get("/google/failure", (req, res) => {
    res.status(401).json({
        success: false,
        message: "Google authentication failed.",
    });
});
export default router;
