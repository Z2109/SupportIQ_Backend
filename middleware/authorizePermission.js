import authorizationService from "../services/authorizationService.js";

const authorizePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const organizationId =
        req.params.organizationId ||
        req.body.organizationId ||
        req.query.organizationId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const allowed = await authorizationService.can({
        userId,
        organizationId,
        permission,
      });

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
        });
      }

      next();
    } catch (error) {
      console.error("Authorization middleware error:", error);

      return res.status(500).json({
        success: false,
        message: "Authorization failed",
      });
    }
  };
};

export default authorizePermission;