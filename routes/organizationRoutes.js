
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
    createOrganization,
    getMyOrganizations,
    getSingleOrganization,
    updateOrganization,
    deleteOrganization,
    getOrganizationMembers,
    addTeamMember,
    removeTeamMember,
    changeMemberRole,
} from "../controllers/organizationController.js";

const router = express.Router();

// Protect all organization routes
router.use(authMiddleware);

// Organization APIs
router.post("/", createOrganization);
router.get("/", getMyOrganizations);
router.get("/:organizationId", getSingleOrganization);
router.patch("/:organizationId", updateOrganization);
router.delete("/:organizationId", deleteOrganization);

// Organization member APIs
router.get("/:organizationId/members", getOrganizationMembers);
router.post("/:organizationId/members", addTeamMember);
router.delete("/:organizationId/members/:userId", removeTeamMember);
router.patch("/:organizationId/members/:userId/role", changeMemberRole);

export default router;
