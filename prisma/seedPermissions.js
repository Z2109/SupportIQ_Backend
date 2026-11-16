
import prisma from "../config/prisma.js";
import permissions from "../constants/permissions.js";

const seedPermissions = async () => {
    try {
        console.log("Starting permission seeding...");

        for (const permission of permissions) {
            await prisma.permission.upsert({
                where: {
                    name: permission.name,
                },
                update: {
                    description: permission.description,
                },
                create: {
                    name: permission.name,
                    description: permission.description,
                },
            });
        }

        console.log(`${permissions.length} permissions seeded successfully!`);

    } catch (error) {
        console.error("Permission seeding failed:", error);
        process.exitCode = 1;

    } finally {
        await prisma.$disconnect();
    }
};

seedPermissions();
