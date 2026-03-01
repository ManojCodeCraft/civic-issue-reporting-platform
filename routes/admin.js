const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");

// Protect all routes
router.use(protect);
router.use(authorize("admin"));

router.get("/dashboard", adminController.showDashboard);
router.get("/manage-users", adminController.manageUsers);
router.post("/assign-issue/:id", adminController.assignIssue);
router.get("/issue/:id", adminController.viewIssueDetail); // Add this route
router.get("/sla-settings", adminController.showSLASettings);
router.post("/update-sla", adminController.updateSLA);
router.post("/toggle-user/:id", adminController.toggleUserStatus);

module.exports = router;
