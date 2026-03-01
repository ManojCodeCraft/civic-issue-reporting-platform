const express = require("express");
const router = express.Router();
const citizenController = require("../controllers/citizenController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Protect all routes
router.use(protect);
router.use(authorize("citizen"));

router.get("/dashboard", citizenController.showDashboard);

router.get("/submit-issue", citizenController.showSubmitIssuePage);
router.post(
  "/submit-issue",
  upload.single("photo"),
  citizenController.submitIssue,
);

router.get("/view-issues", citizenController.viewIssues);
router.get("/issue/:id", citizenController.viewIssueDetail);

module.exports = router;
