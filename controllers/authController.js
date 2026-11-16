
import jwt from "jsonwebtoken";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { sendVerificationEmail } from "../services/emailService.js";
import argon2 from "argon2";
import prisma from "../config/prisma.js";

// Register a new user

export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check for existing account
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        // Hash password
        const hashedPassword = await argon2.hash(password);

        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        // Generate verification token
        const verificationToken = randomBytes(32).toString("hex");

        // Hash token before storing
        const tokenHash = createHash("sha256")
            .update(verificationToken)
            .digest("hex");

        // Store verification request
        await prisma.emailVerification.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        // Build verification URL
        const verificationUrl = new URL(
            "/verify-email",
            process.env.CLIENT_URL
        );

        verificationUrl.searchParams.set("token", verificationToken);

        // Send verification email
        try {
            await sendVerificationEmail(
                user.email,
                verificationUrl.toString()
            );
        } catch (emailError) {
            console.error("Verification email failed:", emailError);

            // Remove unusable verification record.
            // The user account remains available for a resend request.
            await prisma.emailVerification.deleteMany({
                where: { tokenHash },
            });
        }

        return res.status(201).json({
            success: true,
            message: "Account created. Please check your email for verification.",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    isVerified: user.isVerified,
                },
            },
        });

    } catch (error) {
        console.error("Registration error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to create account",
        });
    }
};

// login user

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Verify password
        const isPasswordValid = await argon2.verify(
            user.password,
            password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive",
            });
        }

        if (!user.isVerified) {
        return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        });
    }

        // Create session ID
        const sessionId = randomUUID();

        const refreshExpiresIn =
            process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

        const accessExpiresIn =
            process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";

        // Generate access token
        const accessToken = jwt.sign(
            { userId: user.id },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: accessExpiresIn }
        );

        // Generate refresh token
        const refreshToken = jwt.sign(
            {
                userId: user.id,
                sessionId,
            },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: refreshExpiresIn }
        );

        // Hash refresh token before database storage
        const tokenHash = createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        // Calculate session expiration
        const decodedRefresh = jwt.decode(refreshToken);

        // Store session in PostgreSQL
        await prisma.refreshSession.create({
            data: {
                id: sessionId,
                userId: user.id,
                tokenHash,
                expiresAt: new Date(decodedRefresh.exp * 1000),
            },
        });

        // Cookie configuration
        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        };

        // Set access cookie
        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        // Set refresh cookie
        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    isVerified: user.isVerified,
                },
            },
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// get exixting user

export const getCurrentUser = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            data: {
                user: req.user,
            },
        });
    } catch (error) {
        console.error("Get current user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// refresh access token

export const refreshAccessToken = async (req, res) => {
    try {
        const oldRefreshToken = req.cookies?.refreshToken;

        if (!oldRefreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token not found. Please log in again.",
            });
        }

        // Verify the refresh token
        const decoded = jwt.verify(
            oldRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        // Hash the submitted token
        const oldTokenHash = createHash("sha256")
            .update(oldRefreshToken)
            .digest("hex");

        // Find the existing session
        const session = await prisma.refreshSession.findFirst({
            where: {
                id: decoded.sessionId,
                userId: decoded.userId,
                tokenHash: oldTokenHash,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: {
                user: true,
            },
        });

        if (!session || !session.user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Invalid session. Please log in again.",
            });
        }

        // Generate new tokens
        const accessToken = jwt.sign(
            { userId: session.userId },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
        );

        const newRefreshToken = jwt.sign(
            {
                userId: session.userId,
                sessionId: session.id,
            },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
        );

        const newTokenHash = createHash("sha256")
            .update(newRefreshToken)
            .digest("hex");

        const decodedNewToken = jwt.decode(newRefreshToken);

        // Atomically replace the old token hash.
        // This prevents two concurrent refresh requests from both succeeding.
        const rotation = await prisma.refreshSession.updateMany({
            where: {
                id: session.id,
                userId: session.userId,
                tokenHash: oldTokenHash,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            data: {
                tokenHash: newTokenHash,
                expiresAt: new Date(decodedNewToken.exp * 1000),
            },
        });

        if (rotation.count !== 1) {
            return res.status(401).json({
                success: false,
                message: "Refresh token has already been used or revoked.",
            });
        }

        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        };

        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", newRefreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: "Tokens refreshed successfully",
        });

    } catch (error) {
        if (
            error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Refresh token expired or invalid. Please log in again.",
            });
        }

        console.error("Refresh token error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

//  logout
export const logoutUser = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (refreshToken) {
            try {
                const decoded = jwt.verify(
                    refreshToken,
                    process.env.REFRESH_TOKEN_SECRET
                );

                const tokenHash = createHash("sha256")
                    .update(refreshToken)
                    .digest("hex");

                // Revoke only the current session
                await prisma.refreshSession.updateMany({
                    where: {
                        id: decoded.sessionId,
                        userId: decoded.userId,
                        tokenHash,
                        revokedAt: null,
                    },
                    data: {
                        revokedAt: new Date(),
                    },
                });
            } catch (error) {
                // Even if the refresh token is invalid or expired,
                // clear the browser cookies.
                console.log("Refresh session could not be verified.");
            }
        }

        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        };

        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully",
        });

    } catch (error) {
        console.error("Logout error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// logout from all devices


export const logoutAllDevices = async (req, res) => {
    try {
        // Revoke all active sessions belonging to this user
        const result = await prisma.refreshSession.updateMany({
            where: {
                userId: req.user.id,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });

        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        };

        // Clear current browser cookies
        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);

        return res.status(200).json({
            success: true,
            message: "Logged out from all devices successfully",
            revokedSessions: result.count,
        });

    } catch (error) {
        console.error("Logout all devices error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// forgot password

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Find the account
        const user = await prisma.user.findUnique({
            where: { email },
        });

        // Always return a generic response to prevent
        // attackers from discovering registered email addresses.
        const successResponse = {
            success: true,
            message:
                "If an account exists with this email, a password reset link will be sent.",
        };

        if (!user || !user.password) {
            return res.status(200).json(successResponse);
        }

        // Generate a cryptographically secure random token
        const resetToken = randomBytes(32).toString("hex");

        // Store only the SHA-256 hash
        const tokenHash = createHash("sha256")
            .update(resetToken)
            .digest("hex");

        // Expire previous unused reset requests
        await prisma.passwordReset.deleteMany({
            where: {
                userId: user.id,
                usedAt: null,
            },
        });

        // Create a reset record valid for 15 minutes
        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });

        // Build frontend reset URL
        const resetUrl = new URL(
            "/reset-password",
            process.env.CLIENT_URL
        );

        resetUrl.searchParams.set("token", resetToken);

        try {
            await sendPasswordResetEmail(
                user.email,
                resetUrl.toString()
            );
        } catch (emailError) {
            // Invalidate the token if email delivery fails
            await prisma.passwordReset.deleteMany({
                where: {
                    tokenHash,
                    usedAt: null,
                },
            });

            console.error("Password reset email failed:", emailError);
        }

        return res.status(200).json(successResponse);

    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to process password reset request.",
        });
    }
};


export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Hash the token received from the user
        const tokenHash = createHash("sha256")
            .update(token)
            .digest("hex");

        // Find a valid, unused, non-expired reset token
        const resetRecord = await prisma.passwordReset.findFirst({
            where: {
                tokenHash,
                usedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!resetRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired password reset link.",
            });
        }

        // Hash the new password
        const hashedPassword = await argon2.hash(newPassword);

        // Atomically consume the reset token, update password,
        // and revoke all refresh sessions.
        await prisma.$transaction(async (tx) => {
            const consumed = await tx.passwordReset.updateMany({
                where: {
                    id: resetRecord.id,
                    tokenHash,
                    usedAt: null,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                data: {
                    usedAt: new Date(),
                },
            });

            if (consumed.count !== 1) {
                throw new Error("RESET_TOKEN_ALREADY_USED");
            }

            await tx.user.update({
                where: {
                    id: resetRecord.userId,
                },
                data: {
                    password: hashedPassword,
                },
            });

            await tx.refreshSession.updateMany({
                where: {
                    userId: resetRecord.userId,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
            });
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. Please log in again.",
        });

    } catch (error) {
        if (error.message === "RESET_TOKEN_ALREADY_USED") {
            return res.status(400).json({
                success: false,
                message: "This password reset link has already been used or expired.",
            });
        }

        console.error("Reset password error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to reset password.",
        });
    }
};


export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Find the authenticated user
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });

        if (!user || !user.password) {
            return res.status(404).json({
                success: false,
                message: "User account not found.",
            });
        }

        // Verify current password
        const isPasswordValid = await argon2.verify(
            user.password,
            currentPassword
        );

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect.",
            });
        }

        // Hash the new password
        const hashedPassword = await argon2.hash(newPassword);

        // Update password and revoke all refresh sessions
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    password: hashedPassword,
                },
            });

            await tx.refreshSession.updateMany({
                where: {
                    userId: user.id,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
            });
        });

        // Clear current browser authentication cookies
        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        };

        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);

        return res.status(200).json({
            success: true,
            message: "Password changed successfully. Please log in again.",
        });

    } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to change password.",
        });
    }
};


export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        // Hash the token received from the verification link
        const tokenHash = createHash("sha256")
            .update(token)
            .digest("hex");

        // Find a valid, unused verification token
        const verification = await prisma.emailVerification.findFirst({
            where: {
                tokenHash,
                usedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!verification) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification link.",
            });
        }

        // Consume token and verify account atomically
        await prisma.$transaction(async (tx) => {
            const consumed = await tx.emailVerification.updateMany({
                where: {
                    id: verification.id,
                    tokenHash,
                    usedAt: null,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                data: {
                    usedAt: new Date(),
                },
            });

            if (consumed.count !== 1) {
                throw new Error("VERIFICATION_TOKEN_ALREADY_USED");
            }

            await tx.user.update({
                where: {
                    id: verification.userId,
                },
                data: {
                    isVerified: true,
                },
            });
        });

        return res.status(200).json({
            success: true,
            message: "Email verified successfully.",
        });

    } catch (error) {
        if (error.message === "VERIFICATION_TOKEN_ALREADY_USED") {
            return res.status(400).json({
                success: false,
                message: "This verification link has already been used or expired.",
            });
        }

        console.error("Email verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify email.",
        });
    }
};


export const getActiveSessions = async (req, res) => {
    try {
        const sessions = await prisma.refreshSession.findMany({
            where: {
                userId: req.user.id,
                revokedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
            select: {
                id: true,
                createdAt: true,
                expiresAt: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            message: "Active sessions fetched successfully",
            data: {
                sessions,
                totalSessions: sessions.length,
            },
        });

    } catch (error) {
        console.error("Get active sessions error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch active sessions",
        });
    }
};


export const revokeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await prisma.refreshSession.findFirst({
            where: {
                id: sessionId,
                userId: req.user.id,
                revokedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Active session not found",
            });
        }

        await prisma.refreshSession.update({
            where: {
                id: session.id,
            },
            data: {
                revokedAt: new Date(),
            },
        });

        return res.status(200).json({
            success: true,
            message: "Session revoked successfully",
        });

    } catch (error) {
        console.error("Revoke session error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to revoke session",
        });
    }
};


export const cleanupExpiredSessions = async (req, res) => {
    try {
        const result = await prisma.refreshSession.deleteMany({
            where: {
                OR: [
                    {
                        expiresAt: {
                            lte: new Date(),
                        },
                    },
                    {
                        revokedAt: {
                            not: null,
                        },
                    },
                ],
            },
        });

        return res.status(200).json({
            success: true,
            message: "Expired and revoked sessions cleaned up successfully",
            deletedSessions: result.count,
        });

    } catch (error) {
        console.error("Session cleanup error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to clean up sessions",
        });
    }
};


// Oauth

export const googleAuthCallback = async (req, res) => {
    try {
        const user = req.user;

        if (!user || !user.isActive || !user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Google authentication failed.",
            });
        }

        const sessionId = randomUUID();

        const refreshExpiresIn =
            process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

        const accessExpiresIn =
            process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";

        const accessToken = jwt.sign(
            { userId: user.id },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: accessExpiresIn }
        );

        const refreshToken = jwt.sign(
            { userId: user.id, sessionId },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: refreshExpiresIn }
        );

        const tokenHash = createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        const decodedRefresh = jwt.decode(refreshToken);

        await prisma.refreshSession.create({
            data: {
                id: sessionId,
                userId: user.id,
                tokenHash,
                expiresAt: new Date(decodedRefresh.exp * 1000),
            },
        });

        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        };

        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: "Google login successful",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    isVerified: user.isVerified,
                },
            },
        });

    } catch (error) {
        console.error("Google authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Google authentication failed.",
        });
    }
};








