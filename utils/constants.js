module.exports = {
  USER_ROLES: {
    CITIZEN: "citizen",
    AUTHORITY: "authority",
    ADMIN: "admin",
  },

  ISSUE_STATUS: {
    REPORTED: "Reported",
    VERIFIED: "Verified",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  },

  ISSUE_CATEGORIES: {
    ROADS: "Road Damage",
    WASTE: "Waste Management",
    WATER: "Water Supply",
    LIGHTING: "Street Lighting",
    DRAINAGE: "Drainage",
    PARKS: "Parks & Gardens",
    OTHER: "Other",
  },

  SLA_DEFAULTS: {
    "Road Damage": 7, // days
    "Waste Management": 2,
    "Water Supply": 1,
    "Street Lighting": 3,
    Drainage: 5,
    "Parks & Gardens": 10,
    Other: 7,
  },
};
