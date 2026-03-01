const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

router.get("/", publicController.showHomePage);
router.get("/dashboard", publicController.showPublicDashboard);

module.exports = router;
