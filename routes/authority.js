const express = require("express");
const router = express.Router();
const authorityController = require("../controllers/authorityController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Protect all routes
router.use(protect);
router.use(authorize("authority"));

router.get("/dashboard", authorityController.showDashboard);
router.get("/manage-issues", authorityController.manageIssues);
router.get("/issue/:id", authorityController.viewIssueDetail);
router.post(
  "/update-status/:id",
  upload.single("evidence"),
  authorityController.updateStatus,
);

module.exports = router;
