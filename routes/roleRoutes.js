
import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizePermission from "../middleware/authorizePermission.js";

import {
  createRole,
  getOrganizationRoles,
  getSingleRole,
  updateRole,
  deleteRole,
} from "../controllers/roleController.js";

const router = express.Router();

// Authentication for all role routes
router.use(authMiddleware);

// Create custom role
router.post(
  "/organizations/:organizationId/roles",
  authorizePermission("role:create"),
  createRole
);

// Get all organization roles
router.get(
  "/organizations/:organizationId/roles",
  authorizePermission("role:read"),
  getOrganizationRoles
);

// Get single role
router.get(
  "/organizations/:organizationId/roles/:roleId",
  authorizePermission("role:read"),
  getSingleRole
);

// Update custom role and permissions
router.patch(
  "/organizations/:organizationId/roles/:roleId",
  authorizePermission("role:update"),
  updateRole
);

// Delete custom role
router.delete(
  "/organizations/:organizationId/roles/:roleId",
  authorizePermission("role:delete"),
  deleteRole
);

export default router;
