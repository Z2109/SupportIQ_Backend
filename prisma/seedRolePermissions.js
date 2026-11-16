
import prisma from "../config/prisma.js";

const rolePermissions = {
    OWNER: ["*"],

    ADMIN: [
        "organization:read",
        "organization:update",
        "organization:manage_members",
        "role:read",
        "role:assign",
        "ticket:create",
        "ticket:read",
        "ticket:update",
        "ticket:delete",
        "ticket:assign",
        "message:create",
        "message:read",
        "message:delete",
        "analytics:read",
    ],

    AGENT: [
        "organization:read",
        "ticket:create",
        "ticket:read",
        "ticket:update",
        "ticket:assign",
        "message:create",
        "message:read",
    ],

    MEMBER: [
        "organization:read",
        "ticket:create",
        "ticket:read",
        "message:create",
        "message:read",
    ],
};

const seedRolePermissions = async () => {
    try {
        console.log("Starting role-permission seeding...");

        const roles = await prisma.role.findMany({
            include: {
                rolePermissions: true,
            },
        });

        const permissions = await prisma.permission.findMany();

        const permissionMap = new Map(
            permissions.map((permission) => [
                permission.name,
                permission.id,
            ])
        );

        for (const role of roles) {
            const assignedPermissions = rolePermissions[role.name];

            if (!assignedPermissions) {
                continue;
            }

            const selectedPermissions =
                assignedPermissions.includes("*")
                    ? permissions
                    : assignedPermissions.map((name) => {
                        const permissionId = permissionMap.get(name);

                        if (!permissionId) {
                            throw new Error(
                                `Permission not found: ${name}`
                            );
                        }

                        return { id: permissionId };
                    });

            for (const permission of selectedPermissions) {
                const permissionId = permission.id;

                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId: role.id,
                            permissionId,
                        },
                    },
                    update: {},
                    create: {
                        roleId: role.id,
                        permissionId,
                    },
                });
            }

            console.log(
                `${role.name}: ${selectedPermissions.length} permissions assigned`
            );
        }

        console.log("Role permissions seeded successfully!");

    } catch (error) {
        console.error("Role permission seeding failed:", error);
        process.exitCode = 1;

    } finally {
        await prisma.$disconnect();
    }
};

seedRolePermissions();
