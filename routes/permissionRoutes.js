
import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizePermission from "../middleware/authorizePermission.js";

import {
  getAllPermissions,
  getRolePermissions,
  getPermissionsByCategory,
  updateRolePermissions,
} from "../controllers/permissionController.js";

const router = express.Router();

router.use(authMiddleware);

// Get all available permissions
router.get(
  "/permissions",
  getAllPermissions
);

// Get permissions grouped by category
router.get(
  "/permissions/categories",
  getPermissionsByCategory
);

// Get permissions assigned to a role
router.get(
  "/organizations/:organizationId/roles/:roleId/permissions",
  authorizePermission("role:read"),
  getRolePermissions
);

// Update custom role permissions
router.patch(
  "/organizations/:organizationId/roles/:roleId/permissions",
  authorizePermission("role:update"),
  updateRolePermissions
);

export default router;
