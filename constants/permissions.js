
const permissions = [
    // Organization permissions
    {
        name: "organization:read",
        description: "View organization details",
    },
    {
        name: "organization:update",
        description: "Update organization details",
    },
    {
        name: "organization:delete",
        description: "Delete organization",
    },
    {
        name: "organization:manage_members",
        description: "Add and remove organization members",
    },

    // Role permissions
    {
        name: "role:read",
        description: "View roles and permissions",
    },
    {
        name: "role:create",
        description: "Create custom roles",
    },
    {
        name: "role:update",
        description: "Update custom roles",
    },
    {
        name: "role:delete",
        description: "Delete custom roles",
    },
    {
        name: "role:assign",
        description: "Assign roles to organization members",
    },

    // Ticket permissions
    {
        name: "ticket:create",
        description: "Create support tickets",
    },
    {
        name: "ticket:read",
        description: "View support tickets",
    },
    {
        name: "ticket:update",
        description: "Update support tickets",
    },
    {
        name: "ticket:delete",
        description: "Delete support tickets",
    },
    {
        name: "ticket:assign",
        description: "Assign tickets to agents",
    },

    // Message permissions
    {
        name: "message:create",
        description: "Send ticket messages",
    },
    {
        name: "message:read",
        description: "View ticket messages",
    },
    {
        name: "message:delete",
        description: "Delete messages",
    },

    // Analytics permissions
    {
        name: "analytics:read",
        description: "View organization analytics",
    },
];

export default permissions;
