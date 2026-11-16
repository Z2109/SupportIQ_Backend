import prisma from "../config/prisma.js";

const testDatabase = async () => {
    try {
        await prisma.$connect();

        const result = await prisma.$queryRaw`
            SELECT current_database() AS database_name,
                   version() AS database_version
        `;

        console.log("PostgreSQL connected successfully!");
        console.log("Database:", result[0].database_name);
        console.log("Version:", result[0].database_version);

    } catch (error) {
        console.error("Database connection failed:", error.message);
        throw error;
    }
};

export default testDatabase;