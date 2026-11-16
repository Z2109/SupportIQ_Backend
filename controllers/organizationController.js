
import prisma from "../config/prisma.js";
import permissions from "../constants/permissions.js";
import authorizationService from "../services/authorizationService.js";


const defaultRolePermissions = {
  OWNER: permissions.map((permission) => permission.name),

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

export const createOrganization = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid organization name is required",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string or null",
      });
    }

    const cleanName = name.trim();

    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Organization name must contain letters or numbers",
      });
    }

    const organization = await prisma.$transaction(
      async (tx) => {
        // 1. Create organization and owner membership
        const newOrganization = await tx.organization.create({
          data: {
            name: cleanName,
            slug,
            description: description?.trim() || null,
            members: {
              create: {
                userId,
                role: "OWNER",
                status: "ACTIVE",
              },
            },
          },
        });

        // 2. Ensure all permissions exist
        const permissionRecords = [];

        for (const permission of permissions) {
          const record = await tx.permission.upsert({
            where: { name: permission.name },
            update: {
              description: permission.description,
            },
            create: {
              name: permission.name,
              description: permission.description,
            },
          });

          permissionRecords.push(record);
        }

        const permissionMap = new Map(
          permissionRecords.map((permission) => [
            permission.name,
            permission.id,
          ])
        );

        let ownerRoleId;

        // 3. Create default roles and attach permissions
        for (const [roleName, permissionNames] of Object.entries(
          defaultRolePermissions
        )) {
          const role = await tx.role.create({
            data: {
              name: roleName,
              description: `Default ${roleName} role`,
              organizationId: newOrganization.id,
              isSystem: true,
            },
          });

          if (roleName === "OWNER") {
            ownerRoleId = role.id;
          }

          await tx.rolePermission.createMany({
            data: permissionNames.map((permissionName) => {
              const permissionId = permissionMap.get(permissionName);

              if (!permissionId) {
                throw new Error(
                  `Missing permission: ${permissionName}`
                );
              }

              return {
                roleId: role.id,
                permissionId,
              };
            }),
          });
        }

        // 4. Assign OWNER role to organization creator
        await tx.roleAssignment.create({
          data: {
            userId,
            organizationId: newOrganization.id,
            roleId: ownerRoleId,
          },
        });

        // 5. Return organization with membership
        return tx.organization.findUnique({
          where: {
            id: newOrganization.id,
          },
          include: {
            members: {
              select: {
                userId: true,
                role: true,
                status: true,
              },
            },
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 20000,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Organization created successfully.",
      data: {
        organization,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Organization name already exists.",
      });
    }

    console.error("Create organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create organization.",
    });
  }
};




export const getMyOrganizations = async (req, res) => {
    try {
        const organizations = await prisma.organization.findMany({
            where: {
                members: {
                    some: {
                        userId: req.user.id,
                        status: "ACTIVE",
                    },
                },
            },
            include: {
                members: {
                    where: {
                        userId: req.user.id,
                        status: "ACTIVE",
                    },
                    select: {
                        role: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            message: "Organizations fetched successfully",
            data: {
                organizations,
                totalOrganizations: organizations.length,
            },
        });

    } catch (error) {
        console.error("Get organizations error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch organizations",
        });
    }
};

export const getSingleOrganization = async (req, res) => {
    try {
        const { organizationId } = req.params;

        const organization = await prisma.organization.findFirst({
            where: {
                id: organizationId,
                members: {
                    some: {
                        userId: req.user.id,
                        status: "ACTIVE",
                    },
                },
            },
            include: {
                members: {
                    where: { status: "ACTIVE" },
                    select: {
                        id: true,
                        userId: true,
                        role: true,
                        status: true,
                        createdAt: true,
                        user: {
                            select: {
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "Organization not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Organization fetched successfully",
            data: { organization },
        });

    } catch (error) {
        console.error("Get organization error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch organization",
        });
    }
};


export const updateOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { name, description } = req.body;

    // 1. Check dynamic permission
    const allowed = await authorizationService.can({
      userId: req.user.id,
      organizationId,
      permission: "organization:update",
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this organization",
      });
    }

    // 2. Validate request body
    if (name === undefined && description === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide name or description",
      });
    }

    const data = {};

    // 3. Update organization name and slug
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Organization name cannot be empty",
        });
      }

      const cleanName = name.trim();

      const slug = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      if (!slug) {
        return res.status(400).json({
          success: false,
          message: "Organization name must contain letters or numbers",
        });
      }

      data.name = cleanName;
      data.slug = slug;
    }

    // 4. Update description
    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be a string or null",
        });
      }

      data.description = description?.trim() || null;
    }

    // 5. Update database
    const organization = await prisma.organization.update({
      where: {
        id: organizationId,
      },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully",
      data: {
        organization,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Organization slug already exists",
      });
    }

    console.error("Update organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update organization",
    });
  }
};



export const deleteOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    // 1. Check dynamic permission
    const allowed = await authorizationService.can({
      userId: req.user.id,
      organizationId,
      permission: "organization:delete",
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this organization",
      });
    }

    // 2. Check whether organization exists
    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // 3. Delete organization
    await prisma.organization.delete({
      where: {
        id: organizationId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Organization deleted successfully",
    });
  } catch (error) {
    console.error("Delete organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete organization",
    });
  }
};


export const getOrganizationMembers = async (req, res) => {
    try {
        const { organizationId } = req.params;

        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user.id,
                    organizationId,
                },
            },
        });

        if (!membership || membership.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "You are not an active organization member",
            });
        }

        const members = await prisma.organizationMember.findMany({
            where: {
                organizationId,
                status: "ACTIVE",
            },
            select: {
                id: true,
                userId: true,
                role: true,
                status: true,
                createdAt: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        return res.status(200).json({
            success: true,
            message: "Organization members fetched successfully",
            data: {
                members,
                totalMembers: members.length,
            },
        });

    } catch (error) {
        console.error("Get members error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch organization members",
        });
    }
};




export const addTeamMember = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { email, roleId } = req.body;
    const actorId = req.user?.id;

    // 1. Validate request
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid email address is required",
      });
    }

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Find existing active and verified user
    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user || !user.isActive || !user.isVerified) {
      return res.status(404).json({
        success: false,
        message: "Active verified user not found",
      });
    }

    // 3. Find requested role or default MEMBER role
    const role = await prisma.role.findFirst({
      where: roleId
        ? {
            id: roleId,
            organizationId,
          }
        : {
            name: "MEMBER",
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
        message: roleId
          ? "Selected role not found in this organization"
          : "Default MEMBER role not found in this organization",
      });
    }

    // 4. Protect OWNER role
    if (role.name === "OWNER") {
      return res.status(403).json({
        success: false,
        message: "OWNER role cannot be assigned through this endpoint",
      });
    }

    // 5. Fetch acting user's role assignment
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

    if (
      !actorAssignment ||
      actorAssignment.role.organizationId !== organizationId
    ) {
      return res.status(403).json({
        success: false,
        message: "Your organization role assignment was not found",
      });
    }

    // 6. Prevent privilege escalation
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
        message: "You cannot assign a role with permissions you do not possess",
      });
    }

    // 7. Check existing membership
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
    });

    if (existingMembership?.status === "ACTIVE") {
      return res.status(409).json({
        success: false,
        message: "User is already a member of this organization",
      });
    }

    // 8. Create or restore membership and assign role
    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
        update: {
          status: "ACTIVE",
          role: role.name,
        },
        create: {
          userId: user.id,
          organizationId,
          status: "ACTIVE",
          role: role.name,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      const assignment = await tx.roleAssignment.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
        update: {
          roleId: role.id,
        },
        create: {
          userId: user.id,
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
        membership,
        assignment,
      };
    });

    return res.status(existingMembership ? 200 : 201).json({
      success: true,
      message: existingMembership
        ? "Organization membership restored successfully"
        : "Team member added successfully",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        ...result,
      },
    });
  } catch (error) {
    console.error("Add team member error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add team member",
    });
  }
};







export const removeTeamMember = async (req, res) => {
  try {
    const { organizationId, userId } = req.params;
    const actorId = req.user?.id;

    // 1. Validate authentication
    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 2. Prevent self-removal
    if (userId === actorId) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove yourself",
      });
    }

    // 3. Find target membership
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

    // 4. Protect OWNER
    if (membership.role === "OWNER") {
      return res.status(403).json({
        success: false,
        message: "Organization owner cannot be removed",
      });
    }

    // 5. Get acting user's permissions
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
        message: "Your role assignment was not found",
      });
    }

    // 6. Get target user's role assignment
    const targetAssignment = await prisma.roleAssignment.findUnique({
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

    if (!targetAssignment) {
      return res.status(404).json({
        success: false,
        message: "Member role assignment not found",
      });
    }

    // 7. Prevent removing a member with greater privileges
    const actorPermissions = new Set(
      actorAssignment.role.rolePermissions.map(
        (item) => item.permission.name
      )
    );

    const canRemoveMember =
      targetAssignment.role.rolePermissions.every(
        (item) => actorPermissions.has(item.permission.name)
      );

    if (!canRemoveMember) {
      return res.status(403).json({
        success: false,
        message: "You cannot remove a member with greater permissions",
      });
    }

    // 8. Remove membership and role assignment atomically
    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        data: {
          status: "REMOVED",
        },
      });

      await tx.roleAssignment.deleteMany({
        where: {
          userId,
          organizationId,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    console.error("Remove team member error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to remove team member",
    });
  }
};





export const changeMemberRole = async (req, res) => {
  try {
    const { organizationId, userId } = req.params;
    const { roleId } = req.body;
    const actorId = req.user?.id;

    // 1. Validate authentication
    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 2. Validate role ID
    if (typeof roleId !== "string" || !roleId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid role ID is required",
      });
    }

    // 3. Prevent changing your own role
    if (userId === actorId) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    // 4. Find target membership
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

    // 5. Protect OWNER
    if (membership.role === "OWNER") {
      return res.status(403).json({
        success: false,
        message: "Owner role cannot be changed",
      });
    }

    // 6. Find requested role in this organization
    const newRole = await prisma.role.findFirst({
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

    if (!newRole) {
      return res.status(404).json({
        success: false,
        message: "Role not found in this organization",
      });
    }

    // 7. Prevent assigning OWNER
    if (newRole.name === "OWNER") {
      return res.status(403).json({
        success: false,
        message: "OWNER role cannot be assigned through this endpoint",
      });
    }

    // 8. Fetch acting user's assignment
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
        message: "Your role assignment was not found",
      });
    }

    // 9. Fetch target user's current assignment
    const targetAssignment = await prisma.roleAssignment.findUnique({
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

    if (!targetAssignment) {
      return res.status(404).json({
        success: false,
        message: "Member role assignment was not found",
      });
    }

    // 10. Get actor permissions
    const actorPermissions = new Set(
      actorAssignment.role.rolePermissions.map(
        (item) => item.permission.name
      )
    );

    // 11. Prevent modifying a member with greater privileges
    const canManageTarget =
      targetAssignment.role.rolePermissions.every(
        (item) => actorPermissions.has(item.permission.name)
      );

    if (!canManageTarget) {
      return res.status(403).json({
        success: false,
        message: "You cannot change the role of a more privileged member",
      });
    }

    // 12. Prevent assigning permissions the actor does not possess
    const canGrantRole = newRole.rolePermissions.every(
      (item) => actorPermissions.has(item.permission.name)
    );

    if (!canGrantRole) {
      return res.status(403).json({
        success: false,
        message: "You cannot assign a role with greater permissions than your own",
      });
    }

    // 13. Update membership and role assignment together
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
            role: newRole.name,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
          roleId: newRole.id,
        },
        create: {
          userId,
          organizationId,
          roleId: newRole.id,
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
      message: "Member role updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Change member role error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to change member role",
    });
  }
};


