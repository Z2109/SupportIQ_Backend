
import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizePermission from "../middleware/authorizePermission.js";

import {
  assignRole,
  getUserRoleAssignment,
  getOrganizationRoleAssignments,
} from "../controllers/roleAssignmentController.js";

const router = express.Router();

// Protect all role assignment routes
router.use(authMiddleware);

// Assign role to an organization member
router.patch(
  "/organizations/:organizationId/members/:userId/role-assignment",
  authorizePermission("role:assign"),
  assignRole
);

// Get a specific member's role assignment
router.get(
  "/organizations/:organizationId/members/:userId/role-assignment",
  authorizePermission("role:read"),
  getUserRoleAssignment
);

// Get all role assignments in an organization
router.get(
  "/organizations/:organizationId/role-assignments",
  authorizePermission("role:read"),
  getOrganizationRoleAssignments
);

export default router;
