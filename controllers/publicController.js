const Issue = require("../models/Issue");
const { ISSUE_STATUS, ISSUE_CATEGORIES } = require("../utils/constants");

// @desc    Show public homepage
// @route   GET /
exports.showHomePage = (req, res) => {
  res.render("public/home", {
    title: "CivicTrack - Urban Issue Reporting Platform",
  });
};

// @desc    Show public dashboard
// @route   GET /public/dashboard OR /dashboard
exports.showPublicDashboard = async (req, res) => {
  try {
    // Overall statistics
    const totalIssues = await Issue.countDocuments();
    const resolvedIssues = await Issue.countDocuments({
      status: { $in: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
    });
    const pendingIssues = await Issue.countDocuments({
      status: {
        $in: [
          ISSUE_STATUS.REPORTED,
          ISSUE_STATUS.VERIFIED,
          ISSUE_STATUS.IN_PROGRESS,
        ],
      },
    });
    const overdueIssues = await Issue.countDocuments({
      isOverdue: true,
      status: {
        $in: [
          ISSUE_STATUS.REPORTED,
          ISSUE_STATUS.VERIFIED,
          ISSUE_STATUS.IN_PROGRESS,
        ],
      },
    });

    // Category-wise breakdown
    const categoryStats = await Issue.aggregate([
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", ISSUE_STATUS.RESOLVED] },
                    { $eq: ["$status", ISSUE_STATUS.CLOSED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          pending: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", ISSUE_STATUS.RESOLVED] },
                    { $ne: ["$status", ISSUE_STATUS.CLOSED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Status-wise distribution
    const statusStats = await Issue.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Area-wise distribution (top 10)
    const areaStats = await Issue.aggregate([
      {
        $group: {
          _id: "$location.address",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // SLA Compliance
    const slaCompliance = {
      onTime: await Issue.countDocuments({
        status: { $in: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
        isOverdue: false,
      }),
      delayed: await Issue.countDocuments({
        status: { $in: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
        isOverdue: true,
      }),
      pending: pendingIssues,
    };

    // Recent resolved issues
    const recentResolved = await Issue.find({
      status: { $in: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
    })
      .select(
        "issueId category location.address status resolutionTime closedAt",
      )
      .sort({ closedAt: -1 })
      .limit(10);

    // Calculate average resolution time
    const avgResolutionResult = await Issue.aggregate([
      {
        $match: {
          status: { $in: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
          resolutionTime: { $ne: null, $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$resolutionTime" },
        },
      },
    ]);

    const avgResolutionTime =
      avgResolutionResult.length > 0
        ? Math.round(avgResolutionResult[0].avgTime)
        : 0;

    res.render("public/dashboard", {
      title: "Public Dashboard",
      stats: {
        totalIssues,
        resolvedIssues,
        pendingIssues,
        overdueIssues,
        resolutionRate:
          totalIssues > 0
            ? Math.round((resolvedIssues / totalIssues) * 100)
            : 0,
        avgResolutionTime,
      },
      categoryStats,
      statusStats,
      areaStats,
      slaCompliance,
      recentResolved,
    });
  } catch (error) {
    console.error("Public Dashboard Error:", error);
    res.render("error", {
      title: "Error",
      message: "Failed to load dashboard",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};
