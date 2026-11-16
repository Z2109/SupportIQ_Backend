
import Joi from "joi";

export const registerSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .required()
        .messages({
            "string.empty": "Name is required",
            "string.min": "Name must contain at least 2 characters",
            "string.max": "Name cannot exceed 50 characters",
            "any.required": "Name is required",
        }),

    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(255)
        .required()
        .messages({
            "string.email": "Please provide a valid email address",
            "string.empty": "Email is required",
            "any.required": "Email is required",
        }),

    password: Joi.string()
        .min(8)
        .max(128)
        .required()
        .messages({
            "string.min": "Password must be at least 8 characters",
            "string.max": "Password cannot exceed 128 characters",
            "string.empty": "Password is required",
            "any.required": "Password is required",
        }),
});


export const loginSchema = Joi.object({
    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .required()
        .messages({
            "string.email": "Please provide a valid email",
            "any.required": "Email is required",
            "string.empty": "Email is required",
        }),

    password: Joi.string()
        .min(1)
        .required()
        .messages({
            "string.empty": "Password is required",
            "any.required": "Password is required",
        }),
});

export const forgotPasswordSchema = Joi.object({
    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .required(),
});


export const resetPasswordSchema = Joi.object({
    token: Joi.string()
        .hex()
        .length(64)
        .required(),

    newPassword: Joi.string()
        .min(8)
        .max(128)
        .required()
        .messages({
            "string.min": "Password must be at least 8 characters",
            "string.max": "Password cannot exceed 128 characters",
            "any.required": "New password is required",
        }),
});


export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string()
        .required()
        .messages({
            "any.required": "Current password is required",
            "string.empty": "Current password is required",
        }),

    newPassword: Joi.string()
        .min(8)
        .max(128)
        .required()
        .invalid(Joi.ref("currentPassword"))
        .messages({
            "string.min": "New password must be at least 8 characters",
            "string.max": "New password cannot exceed 128 characters",
            "any.invalid": "New password must be different from current password",
            "any.required": "New password is required",
        }),
});

export const verifyEmailSchema = Joi.object({
    token: Joi.string()
        .hex()
        .length(64)
        .required(),
});
