import prisma from "../config/prisma.js";

const seedRoleAssignments = async () => {
  try {
    console.log("Starting role assignment seeding...");

    const memberships = await prisma.organizationMember.findMany({
      where: {
        status: "ACTIVE",
      },
    });

    for (const membership of memberships) {
      const role = await prisma.role.findUnique({
        where: {
          name_organizationId: {
            name: membership.role,
            organizationId: membership.organizationId,
          },
        },
      });

      if (!role) {
        console.log(
          `Role ${membership.role} not found for organization ${membership.organizationId}`
        );
        continue;
      }

      await prisma.roleAssignment.upsert({
        where: {
          userId_organizationId: {
            userId: membership.userId,
            organizationId: membership.organizationId,
          },
        },
        update: {
          roleId: role.id,
        },
        create: {
          userId: membership.userId,
          organizationId: membership.organizationId,
          roleId: role.id,
        },
      });

      console.log(
        `Assigned ${role.name} to user ${membership.userId}`
      );
    }

    console.log("Role assignments seeded successfully!");
  } catch (error) {
    console.error("Role assignment seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

seedRoleAssignments();