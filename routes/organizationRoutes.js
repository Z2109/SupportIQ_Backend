
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizePermission from "../middleware/authorizePermission.js";

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

router.get(
  "/:organizationId",
  authorizePermission("organization:read"),
  getSingleOrganization
);

router.patch(
  "/:organizationId",
  authorizePermission("organization:update"),
  updateOrganization
);

router.delete(
  "/:organizationId",
  authorizePermission("organization:delete"),
  deleteOrganization
);

// Organization member APIs
router.get(
  "/:organizationId/members",
  authorizePermission("organization:read"),
  getOrganizationMembers
);

router.post(
  "/:organizationId/members",
  authorizePermission("organization:manage_members"),
  addTeamMember
);

router.delete(
  "/:organizationId/members/:userId",
  authorizePermission("organization:manage_members"),
  removeTeamMember
);

router.patch(
  "/:organizationId/members/:userId/role",
  authorizePermission("role:assign"),
  changeMemberRole
);

export default router;
