
import prisma from "../config/prisma.js";

const defaultRoles = [
    {
        name: "OWNER",
        description: "Full access to the organization",
    },
    {
        name: "ADMIN",
        description: "Manage organization members, roles and tickets",
    },
    {
        name: "AGENT",
        description: "Handle and respond to support tickets",
    },
    {
        name: "MEMBER",
        description: "Basic organization access",
    },
];

const seedRoles = async () => {
    try {
        console.log("Starting role seeding...");

        const organizations = await prisma.organization.findMany({
            select: {
                id: true,
                name: true,
            },
        });

        if (organizations.length === 0) {
            console.log("No organizations found. Create an organization first.");
            return;
        }

        for (const organization of organizations) {
            for (const role of defaultRoles) {
                await prisma.role.upsert({
                    where: {
                        name_organizationId: {
                            name: role.name,
                            organizationId: organization.id,
                        },
                    },
                    update: {
                        description: role.description,
                    },
                    create: {
                        name: role.name,
                        description: role.description,
                        organizationId: organization.id,
                        isSystem: true,
                    },
                });
            }

            console.log(`Roles seeded for ${organization.name}`);
        }

        console.log("Default roles seeded successfully!");

    } catch (error) {
        console.error("Role seeding failed:", error);
        process.exitCode = 1;

    } finally {
        await prisma.$disconnect();
    }
};

seedRoles();
