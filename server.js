import dotenv from "dotenv";

dotenv.config();

import app from "./app.js";
import testDatabase from "./utils/testDatabase.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await testDatabase();

        app.listen(PORT, () => {
            console.log(`SupportIQ running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();