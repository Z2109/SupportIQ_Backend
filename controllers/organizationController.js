
import prisma from "../config/prisma.js";

export const createOrganization = async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user.id;

        // Generate organization slug
        const slug = name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Check whether slug already exists
        const existingOrganization = await prisma.organization.findUnique({
            where: { slug },
        });

        if (existingOrganization) {
            return res.status(409).json({
                success: false,
                message: "Organization name already exists.",
            });
        }

        // Create organization and assign creator as OWNER
        const organization = await prisma.organization.create({
            data: {
                name: name.trim(),
                slug,
                description: description || null,

                members: {
                    create: {
                        userId,
                        role: "OWNER",
                        status: "ACTIVE",
                    },
                },
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

        return res.status(201).json({
            success: true,
            message: "Organization created successfully.",
            data: {
                organization,
            },
        });

    } catch (error) {
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

        if (membership.role !== "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Only the owner can update the organization",
            });
        }

        if (name === undefined && description === undefined) {
            return res.status(400).json({
                success: false,
                message: "Provide name or description",
            });
        }

        const data = {};

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Organization name cannot be empty",
                });
            }

            const cleanName = name.trim();

            data.name = cleanName;
            data.slug = cleanName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
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

        const organization = await prisma.organization.update({
            where: { id: organizationId },
            data,
        });

        return res.status(200).json({
            success: true,
            message: "Organization updated successfully",
            data: { organization },
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

        if (membership.role !== "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Only the owner can delete the organization",
            });
        }

        await prisma.organization.delete({
            where: { id: organizationId },
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
        const { email } = req.body;

        const owner = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user.id,
                    organizationId,
                },
            },
        });

        if (!owner || owner.status !== "ACTIVE" || owner.role !== "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Only the organization owner can add members",
            });
        }

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Valid email is required",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                email: email.trim().toLowerCase(),
            },
        });

        if (!user || !user.isActive || !user.isVerified) {
            return res.status(404).json({
                success: false,
                message: "Active verified user not found",
            });
        }

        const existingMembership =
            await prisma.organizationMember.findUnique({
                where: {
                    userId_organizationId: {
                        userId: user.id,
                        organizationId,
                    },
                },
            });

        if (existingMembership) {
            if (existingMembership.status === "ACTIVE") {
                return res.status(409).json({
                    success: false,
                    message: "User is already a member",
                });
            }

            const restoredMember =
                await prisma.organizationMember.update({
                    where: { id: existingMembership.id },
                    data: {
                        status: "ACTIVE",
                        role: "MEMBER",
                    },
                });

            return res.status(200).json({
                success: true,
                message: "Membership restored successfully",
                data: { member: restoredMember },
            });
        }

        const member = await prisma.organizationMember.create({
            data: {
                userId: user.id,
                organizationId,
                role: "MEMBER",
                status: "ACTIVE",
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return res.status(201).json({
            success: true,
            message: "Team member added successfully",
            data: { member },
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

        const owner = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user.id,
                    organizationId,
                },
            },
        });

        if (!owner || owner.status !== "ACTIVE" || owner.role !== "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Only the organization owner can remove members",
            });
        }

        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "Owner cannot remove themselves",
            });
        }

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
                message: "Active member not found",
            });
        }

        if (membership.role === "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Organization owner cannot be removed",
            });
        }

        await prisma.organizationMember.update({
            where: { id: membership.id },
            data: { status: "REMOVED" },
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
        const { role } = req.body;

        const allowedRoles = ["ADMIN", "MEMBER"];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Role must be ADMIN or MEMBER",
            });
        }

        const owner = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user.id,
                    organizationId,
                },
            },
        });

        if (!owner || owner.status !== "ACTIVE" || owner.role !== "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Only the organization owner can change roles",
            });
        }

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
                message: "Active member not found",
            });
        }

        if (membership.role === "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Owner role cannot be changed here",
            });
        }

        const updatedMember = await prisma.organizationMember.update({
            where: { id: membership.id },
            data: { role },
        });

        return res.status(200).json({
            success: true,
            message: "Member role updated successfully",
            data: { member: updatedMember },
        });

    } catch (error) {
        console.error("Change member role error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to change member role",
        });
    }
};