const express = require("express");
const router = express.Router();
const mapController = require("../controllers/mapController");

// Public routes (no auth required for viewing map)
router.get("/", mapController.showMapView);
router.get("/api/issues", mapController.getMapIssues);
router.get("/api/clusters", mapController.getIssueClusters);
router.get("/api/heatmap", mapController.getHeatmapData);
router.get("/api/statistics", mapController.getMapStatistics);

module.exports = router;
