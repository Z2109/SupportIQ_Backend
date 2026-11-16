
import prisma from "../config/prisma.js";

// ============================================
// ASSIGN ROLE TO ORGANIZATION MEMBER
// ============================================
export const assignRole = async (req, res) => {
  try {
    const { organizationId, userId } = req.params;
    const { roleId } = req.body;
    const actorId = req.user?.id;

    // 1. Validate role ID
    if (typeof roleId !== "string" || !roleId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid role ID is required",
      });
    }

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 2. Find active target membership
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Active organization member not found",
      });
    }

    // 3. Protect the existing OWNER
    if (membership.role === "OWNER") {
      return res.status(403).json({
        success: false,
        message: "Owner role cannot be changed",
      });
    }

    // 4. Find the requested role in this organization
    const role = await prisma.role.findFirst({
      where: {
        id: roleId.trim(),
        organizationId,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found in this organization",
      });
    }

    // 5. OWNER cannot be assigned through this endpoint
    // Use a separate ownership-transfer process for this.
    if (role.name === "OWNER") {
      return res.status(403).json({
        success: false,
        message: "OWNER role cannot be assigned through this endpoint",
      });
    }

    // 6. Fetch the acting user's role and permissions
    const actorAssignment = await prisma.roleAssignment.findUnique({
      where: {
        userId_organizationId: {
          userId: actorId,
          organizationId,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!actorAssignment) {
      return res.status(403).json({
        success: false,
        message: "Your organization role assignment was not found",
      });
    }

    // 7. Ensure the actor cannot grant permissions
    // that they do not personally possess.
    const actorPermissions = new Set(
      actorAssignment.role.rolePermissions.map(
        (item) => item.permission.name
      )
    );

    const canGrantRole = role.rolePermissions.every(
      (item) => actorPermissions.has(item.permission.name)
    );

    if (!canGrantRole) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot assign a role with greater permissions than your own",
      });
    }

    // 8. Update membership and role assignment together
    const result = await prisma.$transaction(async (tx) => {
      const updatedMembership =
        await tx.organizationMember.update({
          where: {
            userId_organizationId: {
              userId,
              organizationId,
            },
          },
          data: {
            role: role.name,
          },
        });

      const assignment = await tx.roleAssignment.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        update: {
          roleId: role.id,
        },
        create: {
          userId,
          organizationId,
          roleId: role.id,
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      return {
        membership: updatedMembership,
        assignment,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Role assigned successfully",
      data: result,
    });
  } catch (error) {
    console.error("Assign role error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign role",
    });
  }
};


// ============================================
// GET MEMBER ROLE ASSIGNMENT
// ============================================
export const getUserRoleAssignment = async (req, res) => {
  try {
    const { organizationId, userId } = req.params;

    // 1. Verify active membership
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Active organization member not found",
      });
    }

    // 2. Fetch role assignment
    const assignment = await prisma.roleAssignment.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Role assignment not found",
      });
    }

    // 3. Verify role belongs to this organization
    if (assignment.role.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        message: "Invalid organization role assignment",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Role assignment fetched successfully",
      data: {
        assignment,
      },
    });
  } catch (error) {
    console.error("Get role assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch role assignment",
    });
  }
};


// ============================================
// GET ALL ORGANIZATION ROLE ASSIGNMENTS
// ============================================
export const getOrganizationRoleAssignments = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const assignments = await prisma.roleAssignment.findMany({
      where: {
        organizationId,
        role: {
          organizationId,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Organization role assignments fetched successfully",
      data: {
        assignments,
        totalAssignments: assignments.length,
      },
    });
  } catch (error) {
    console.error("Get organization role assignments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch role assignments",
    });
  }
};
