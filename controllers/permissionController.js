
import prisma from "../config/prisma.js";

// ============================================
// GET ALL AVAILABLE PERMISSIONS
// ============================================
export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Permissions fetched successfully",
      data: {
        permissions,
        totalPermissions: permissions.length,
      },
    });
  } catch (error) {
    console.error("Get all permissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch permissions",
    });
  }
};


// ============================================
// GET PERMISSIONS ASSIGNED TO A ROLE
// ============================================
export const getRolePermissions = async (req, res) => {
  try {
    const { organizationId, roleId } = req.params;

    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
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

    const permissions = role.rolePermissions.map(
      (item) => item.permission
    );

    return res.status(200).json({
      success: true,
      message: "Role permissions fetched successfully",
      data: {
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
        },
        permissions,
        totalPermissions: permissions.length,
      },
    });
  } catch (error) {
    console.error("Get role permissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch role permissions",
    });
  }
};


// ============================================
// GET PERMISSIONS GROUPED BY CATEGORY
// ============================================
export const getPermissionsByCategory = async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: {
        name: "asc",
      },
    });

    const groupedPermissions = permissions.reduce(
      (groups, permission) => {
        const category = permission.name.split(":")[0];

        if (!groups[category]) {
          groups[category] = [];
        }

        groups[category].push(permission);

        return groups;
      },
      {}
    );

    return res.status(200).json({
      success: true,
      message: "Permissions grouped successfully",
      data: {
        groupedPermissions,
      },
    });
  } catch (error) {
    console.error("Get permissions by category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to group permissions",
    });
  }
};


// ============================================
// UPDATE PERMISSIONS ASSIGNED TO A CUSTOM ROLE
// ============================================
export const updateRolePermissions = async (req, res) => {
  try {
    const { organizationId, roleId } = req.params;
    const { permissions } = req.body;
    const actorId = req.user?.id;

    // 1. Validate authentication
    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 2. Validate permissions array
    if (
      !Array.isArray(permissions) ||
      permissions.some(
        (permission) =>
          typeof permission !== "string" ||
          !permission.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Permissions must be an array of valid permission names",
      });
    }

    // 3. Remove duplicate permission names
    const uniquePermissions = [
      ...new Set(permissions.map((permission) => permission.trim())),
    ];

    // 4. Find the role in the organization
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found in this organization",
      });
    }

    // 5. Protect system roles
    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        message: "System role permissions cannot be modified",
      });
    }

    // 6. Find the acting user's role assignment
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

    // 7. Get actor's permissions
    const actorPermissions = new Set(
      actorAssignment.role.rolePermissions.map(
        (item) => item.permission.name
      )
    );

    // 8. Verify requested permissions exist
    const permissionRecords = await prisma.permission.findMany({
      where: {
        name: {
          in: uniquePermissions,
        },
      },
    });

    if (permissionRecords.length !== uniquePermissions.length) {
      return res.status(400).json({
        success: false,
        message: "One or more permission names are invalid",
      });
    }

    // 9. Prevent privilege escalation
    const canGrantPermissions = uniquePermissions.every(
      (permission) => actorPermissions.has(permission)
    );

    if (!canGrantPermissions) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot grant permissions that you do not personally possess",
      });
    }

    // 10. Update permissions using a transaction
    const updatedRole = await prisma.$transaction(async (tx) => {
      // Remove existing permissions
      await tx.rolePermission.deleteMany({
        where: {
          roleId,
        },
      });

      // Add new permissions
      if (permissionRecords.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRecords.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
        });
      }

      // Return updated role
      return tx.role.findUnique({
        where: {
          id: roleId,
        },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Role permissions updated successfully",
      data: {
        role: updatedRole,
        totalPermissions: updatedRole.rolePermissions.length,
      },
    });
  } catch (error) {
    console.error("Update role permissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update role permissions",
    });
  }
};
