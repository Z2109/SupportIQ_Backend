import "dotenv/config";
import nodemailer from "nodemailer";

// 1. Create SMTP transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// 2. Verify SMTP connection
transporter.verify((error) => {
    if (error) {
        console.error("SMTP connection failed:", {
            message: error.message,
            code: error.code,
            command: error.command,
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            userConfigured: Boolean(process.env.SMTP_USER),
            passwordConfigured: Boolean(process.env.SMTP_PASS),
        });
    } else {
        console.log("SMTP server is ready to send emails!");
    }
});

// 3. Password reset email
export const sendPasswordResetEmail = async (email, resetUrl) => {
    return transporter.sendMail({
        from: `"SupportIQ" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Reset Your SupportIQ Password",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>Password Reset Request</h2>
                <p>We received a request to reset your SupportIQ password.</p>
                <p>Click below to create a new password:</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>This link expires in 15 minutes and can only be used once.</p>
                <p>If you did not request this, ignore this email.</p>
                <p>Regards,<br/>SupportIQ Team</p>
            </div>
        `,
    });
};

// 4. Email verification
export const sendVerificationEmail = async (email, verificationUrl) => {
    return transporter.sendMail({
        from: `"SupportIQ" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Verify Your SupportIQ Account",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>Welcome to SupportIQ!</h2>
                <p>Thank you for creating your SupportIQ account.</p>
                <p>Please verify your email address:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link expires in 24 hours and can only be used once.</p>
                <p>Regards,<br/>SupportIQ Team</p>
            </div>
        `,
    });
};

export default transporter;
