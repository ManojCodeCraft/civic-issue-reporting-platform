const Issue = require("../models/Issue");
const { ISSUE_STATUS } = require("../utils/constants");
const geolib = require("geolib");

// @desc    Show map view
// @route   GET /map
exports.showMapView = (req, res) => {
  res.render("map/index", {
    title: "Issue Map",
    user: req.user || null,
    error: req.flash("error"),
    success: req.flash("success"),
  });
};

// @desc    Get all issues with coordinates for map
// @route   GET /api/map/issues
exports.getMapIssues = async (req, res) => {
  try {
    const { status, category, overdue } = req.query;

    let filter = {
      "location.coordinates.coordinates": { $exists: true, $ne: [] },
    };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (overdue === "true") filter.isOverdue = true;

    const issues = await Issue.find(filter)
      .populate("citizen", "name")
      .populate("assignedTo", "name department")
      .select(
        "issueId category description location status isOverdue priority createdAt slaDeadline",
      )
      .lean();

    // Format for map display
    const mapIssues = issues.map((issue) => ({
      id: issue._id,
      issueId: issue.issueId,
      category: issue.category,
      description: issue.description.substring(0, 100) + "...",
      status: issue.status,
      isOverdue: issue.isOverdue,
      priority: issue.priority || "Medium",
      latitude: issue.location.coordinates.coordinates[1],
      longitude: issue.location.coordinates.coordinates[0],
      address: issue.location.address,
      citizen: issue.citizen?.name || "Anonymous",
      assignedTo: issue.assignedTo?.name || "Unassigned",
      createdAt: issue.createdAt,
      slaDeadline: issue.slaDeadline,
    }));

    res.json({
      success: true,
      count: mapIssues.length,
      issues: mapIssues,
    });
  } catch (error) {
    console.error("Get Map Issues Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch map data",
      error: error.message,
    });
  }
};

// @desc    Get issue clusters for heat map
// @route   GET /api/map/clusters
exports.getIssueClusters = async (req, res) => {
  try {
    const issues = await Issue.find({
      "location.coordinates.coordinates": { $exists: true, $ne: [] },
    })
      .select("location.coordinates category status")
      .lean();

    // Simple clustering by proximity (K-means-like approach)
    const clusters = performClustering(issues, 10); // 10 clusters

    res.json({
      success: true,
      clusters: clusters,
    });
  } catch (error) {
    console.error("Get Clusters Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate clusters",
      error: error.message,
    });
  }
};

// @desc    Get heat map data
// @route   GET /api/map/heatmap
exports.getHeatmapData = async (req, res) => {
  try {
    const issues = await Issue.find({
      "location.coordinates.coordinates": { $exists: true, $ne: [] },
      status: {
        $in: [
          ISSUE_STATUS.REPORTED,
          ISSUE_STATUS.VERIFIED,
          ISSUE_STATUS.IN_PROGRESS,
        ],
      },
    })
      .select("location.coordinates priority isOverdue")
      .lean();

    // Format for heatmap - [lat, lng, intensity]
    const heatmapData = issues.map((issue) => {
      let intensity = 0.5;

      // Increase intensity based on priority
      if (issue.priority === "High") intensity = 0.7;
      if (issue.priority === "Critical") intensity = 0.9;
      if (issue.isOverdue) intensity = 1.0;

      return [
        issue.location.coordinates.coordinates[1], // latitude
        issue.location.coordinates.coordinates[0], // longitude
        intensity,
      ];
    });

    res.json({
      success: true,
      heatmap: heatmapData,
    });
  } catch (error) {
    console.error("Get Heatmap Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate heatmap",
      error: error.message,
    });
  }
};

// @desc    Get statistics by area
// @route   GET /api/map/statistics
exports.getMapStatistics = async (req, res) => {
  try {
    const stats = await Issue.aggregate([
      {
        $match: {
          "location.coordinates.coordinates": { $exists: true, $ne: [] },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Category distribution
    const categoryStats = await Issue.aggregate([
      {
        $match: {
          "location.coordinates.coordinates": { $exists: true, $ne: [] },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      statusDistribution: stats,
      categoryDistribution: categoryStats,
    });
  } catch (error) {
    console.error("Get Map Statistics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// Helper function for clustering
function performClustering(issues, numClusters) {
  if (issues.length === 0) return [];

  // Extract coordinates
  const points = issues.map((issue) => ({
    lat: issue.location.coordinates.coordinates[1],
    lng: issue.location.coordinates.coordinates[0],
    category: issue.category,
    status: issue.status,
  }));

  // Simple grid-based clustering
  const clusters = [];
  const gridSize = 0.01; // ~1km grid
  const grid = {};

  points.forEach((point) => {
    const gridKey = `${Math.floor(point.lat / gridSize)}_${Math.floor(point.lng / gridSize)}`;

    if (!grid[gridKey]) {
      grid[gridKey] = {
        lat: point.lat,
        lng: point.lng,
        count: 0,
        issues: [],
      };
    }

    grid[gridKey].count++;
    grid[gridKey].issues.push({
      category: point.category,
      status: point.status,
    });
  });

  // Convert to array and calculate center
  Object.keys(grid).forEach((key) => {
    const cluster = grid[key];

    // Calculate average position
    const avgLat =
      cluster.issues.reduce((sum, i) => sum + cluster.lat, 0) / cluster.count;
    const avgLng =
      cluster.issues.reduce((sum, i) => sum + cluster.lng, 0) / cluster.count;

    clusters.push({
      center: [avgLat, avgLng],
      count: cluster.count,
      radius: Math.min(cluster.count * 50, 500), // Scale radius by count
      categories: [...new Set(cluster.issues.map((i) => i.category))],
    });
  });

  return clusters;
}
