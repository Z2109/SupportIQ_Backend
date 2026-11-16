
import prisma from "../config/prisma.js";

const can = async ({ userId, organizationId, permission }) => {
  try {
    // Validate required inputs
    if (!userId || !organizationId || !permission) {
      return false;
    }

    // Find active organization membership
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return false;
    }

    // Find role assignment and its permissions
    const assignment = await prisma.roleAssignment.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: {
        role: {
          select: {
            id: true,
            organizationId: true,
            rolePermissions: {
              where: {
                permission: {
                  name: permission,
                },
              },
              select: {
                permission: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment?.role) {
      return false;
    }

    // Prevent cross-organization role access
    if (assignment.role.organizationId !== organizationId) {
      return false;
    }

    // Check requested permission
    return assignment.role.rolePermissions.some(
      (item) => item.permission.name === permission
    );
  } catch (error) {
    console.error("Authorization service error:", error);
    return false;
  }
};

export default { can };
