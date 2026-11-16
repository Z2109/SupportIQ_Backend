
const validateMiddleware = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map((detail) => detail.message);

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        // Use the validated and normalized data
        req.body = value;

        next();
    };
};

export default validateMiddleware;
