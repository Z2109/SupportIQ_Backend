
import prisma from "../config/prisma.js";

// ============================================
// CREATE CUSTOM ROLE
// ============================================
export const createRole = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { name, description, permissions } = req.body;

    // Validate role name
    if (
      typeof name !== "string" ||
      !/^[A-Z][A-Z0-9_]*$/.test(name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Role name must use uppercase letters, numbers and underscores",
      });
    }

    const roleName = name.trim();

    // Prevent custom roles from using reserved system names
    const reservedRoles = ["OWNER", "ADMIN", "AGENT", "MEMBER"];

    if (reservedRoles.includes(roleName)) {
      return res.status(400).json({
        success: false,
        message: "This role name is reserved for system roles",
      });
    }

    // Validate permissions
    if (
      !Array.isArray(permissions) ||
      permissions.length === 0 ||
      permissions.some(
        (permission) =>
          typeof permission !== "string" || !permission.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one valid permission is required",
      });
    }

    const uniquePermissions = [...new Set(permissions)];

    // Find requested permissions
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
        message: "One or more permissions are invalid",
      });
    }

    // Create role and permission mappings
    const role = await prisma.$transaction(async (tx) => {
      return tx.role.create({
        data: {
          name: roleName,
          description:
            typeof description === "string"
              ? description.trim() || null
              : null,
          organizationId,
          isSystem: false,

          rolePermissions: {
            create: permissionRecords.map((permission) => ({
              permissionId: permission.id,
            })),
          },
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

    return res.status(201).json({
      success: true,
      message: "Custom role created successfully",
      data: { role },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Role already exists in this organization",
      });
    }

    console.error("Create role error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create custom role",
    });
  }
};


// ============================================
// GET ALL ORGANIZATION ROLES
// ============================================
export const getOrganizationRoles = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const roles = await prisma.role.findMany({
      where: {
        organizationId,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Organization roles fetched successfully",
      data: {
        roles,
        totalRoles: roles.length,
      },
    });
  } catch (error) {
    console.error("Get organization roles error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch organization roles",
    });
  }
};


// ============================================
// GET SINGLE ROLE
// ============================================
export const getSingleRole = async (req, res) => {
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
        assignments: {
          select: {
            userId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Role fetched successfully",
      data: { role },
    });
  } catch (error) {
    console.error("Get single role error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch role",
    });
  }
};


// ============================================
// UPDATE ROLE AND PERMISSIONS
// ============================================
export const updateRole = async (req, res) => {
  try {
    const { organizationId, roleId } = req.params;
    const { name, description, permissions } = req.body;

    const existingRole = await prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
    });

    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    if (existingRole.isSystem) {
      return res.status(403).json({
        success: false,
        message: "System roles cannot be modified",
      });
    }

    const data = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !/^[A-Z][A-Z0-9_]*$/.test(name.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid role name",
        });
      }

      const reservedRoles = ["OWNER", "ADMIN", "AGENT", "MEMBER"];

      if (reservedRoles.includes(name.trim())) {
        return res.status(400).json({
          success: false,
          message: "This role name is reserved",
        });
      }

      data.name = name.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be a string or null",
        });
      }

      data.description = description?.trim() || null;
    }

    let permissionRecords;

    if (permissions !== undefined) {
      if (
        !Array.isArray(permissions) ||
        permissions.length === 0 ||
        permissions.some(
          (permission) =>
            typeof permission !== "string" || !permission.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "At least one valid permission is required",
        });
      }

      const uniquePermissions = [...new Set(permissions)];

      permissionRecords = await prisma.permission.findMany({
        where: {
          name: {
            in: uniquePermissions,
          },
        },
      });

      if (permissionRecords.length !== uniquePermissions.length) {
        return res.status(400).json({
          success: false,
          message: "One or more permissions are invalid",
        });
      }
    }

    const updatedRole = await prisma.$transaction(async (tx) => {
      // Update role information
      await tx.role.update({
        where: { id: roleId },
        data,
      });

      // Replace permission mappings when supplied
      if (permissionRecords) {
        await tx.rolePermission.deleteMany({
          where: { roleId },
        });

        await tx.rolePermission.createMany({
          data: permissionRecords.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
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
      message: "Role updated successfully",
      data: { role: updatedRole },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Role name already exists",
      });
    }

    console.error("Update role error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update role",
    });
  }
};


// ============================================
// DELETE CUSTOM ROLE
// ============================================
export const deleteRole = async (req, res) => {
  try {
    const { organizationId, roleId } = req.params;

    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        message: "System roles cannot be deleted",
      });
    }

    if (role._count.assignments > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a role assigned to users",
      });
    }

    await prisma.role.delete({
      where: {
        id: roleId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Custom role deleted successfully",
    });
  } catch (error) {
    console.error("Delete role error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete role",
    });
  }
};
