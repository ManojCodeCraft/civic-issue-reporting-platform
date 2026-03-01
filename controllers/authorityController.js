const Issue = require("../models/Issue");
const User = require("../models/User");
const { ISSUE_STATUS, ISSUE_CATEGORIES } = require("../utils/constants");

// @desc    Show authority dashboard
// @route   GET /authority/dashboard
exports.showDashboard = async (req, res) => {
  try {
    // Priority order for sorting
    const priorityOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };

    const issues = await Issue.find({ assignedTo: req.user._id })
      .populate("citizen", "name email phone")
      .sort({
        isOverdue: -1,
        createdAt: -1,
      })
      .limit(10);

    // Sort by priority
    issues.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return b.isOverdue - a.isOverdue;
      return (
        (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5)
      );
    });

    // Check and update overdue status
    issues.forEach((issue) => issue.checkOverdue());
    await Promise.all(issues.map((issue) => issue.save()));

    const stats = {
      total: await Issue.countDocuments({ assignedTo: req.user._id }),
      pending: await Issue.countDocuments({
        assignedTo: req.user._id,
        status: {
          $in: [
            ISSUE_STATUS.REPORTED,
            ISSUE_STATUS.VERIFIED,
            ISSUE_STATUS.IN_PROGRESS,
          ],
        },
      }),
      overdue: await Issue.countDocuments({
        assignedTo: req.user._id,
        isOverdue: true,
        status: { $nin: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
      }),
      resolved: await Issue.countDocuments({
        assignedTo: req.user._id,
        status: ISSUE_STATUS.RESOLVED,
      }),
      critical: await Issue.countDocuments({
        assignedTo: req.user._id,
        priority: "Critical",
        status: { $nin: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
      }),
      high: await Issue.countDocuments({
        assignedTo: req.user._id,
        priority: "High",
        status: { $nin: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
      }),
    };

    res.render("authority/dashboard", {
      title: "Authority Dashboard",
      user: req.user,
      issues,
      stats,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Authority Dashboard Error:", error);
    req.flash("error", "Failed to load dashboard");
    res.redirect("/");
  }
};

// @desc    View all issues for authority
// @route   GET /authority/manage-issues
exports.manageIssues = async (req, res) => {
  try {
    const { status, category, overdue, priority } = req.query;

    let filter = { assignedTo: req.user._id };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (overdue === "true") filter.isOverdue = true;
    if (priority) filter.priority = priority;

    const priorityOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };

    const issues = await Issue.find(filter)
      .populate("citizen", "name email phone address")
      .sort({ isOverdue: -1, slaDeadline: 1 });

    // Sort by priority
    issues.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return b.isOverdue - a.isOverdue;
      return (
        (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5)
      );
    });

    // Update overdue status
    issues.forEach((issue) => issue.checkOverdue());
    await Promise.all(issues.map((issue) => issue.save()));

    res.render("authority/manage-issues", {
      title: "Manage Issues",
      user: req.user,
      issues,
      categories: ISSUE_CATEGORIES,
      statuses: ISSUE_STATUS,
      currentFilter: { status, category, overdue, priority },
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Manage Issues Error:", error);
    req.flash("error", "Failed to load issues");
    res.redirect("/authority/dashboard");
  }
};
// @desc    View single issue detail
// @route   GET /authority/issue/:id
exports.viewIssueDetail = async (req, res) => {
  try {
    const issue = await Issue.findOne({
      _id: req.params.id,
      assignedTo: req.user._id,
    })
      .populate("citizen", "name email phone address")
      .populate("assignedTo", "name department email")
      .populate("timeline.updatedBy", "name role");

    if (!issue) {
      req.flash("error", "Issue not found or not assigned to you");
      return res.redirect("/authority/manage-issues");
    }

    issue.checkOverdue();

    res.render("authority/issue-detail", {
      title: `Issue ${issue.issueId}`,
      user: req.user,
      issue,
      statuses: ISSUE_STATUS,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("View Issue Detail Error:", error);
    req.flash("error", "Failed to load issue details");
    res.redirect("/authority/manage-issues");
  }
};

// @desc    Update issue status
// @route   POST /authority/update-status/:id
exports.updateStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;

    const issue = await Issue.findOne({
      _id: req.params.id,
      assignedTo: req.user._id,
    }).populate("citizen", "name email _id");

    if (!issue) {
      req.flash("error", "Issue not found or not assigned to you");
      return res.redirect("/authority/manage-issues");
    }

    // Store old status
    const oldStatus = issue.status;

    // Validate status transition
    const validStatuses = Object.values(ISSUE_STATUS);
    if (!validStatuses.includes(status)) {
      req.flash("error", "Invalid status");
      return res.redirect(`/authority/issue/${issue._id}`);
    }

    // Update status
    issue.status = status;

    // Add to timeline
    const timelineEntry = {
      status,
      updatedBy: req.user._id,
      remarks: remarks || `Status updated to ${status}`,
    };

    // Add evidence if uploaded
    if (req.file) {
      timelineEntry.evidence = "/uploads/" + req.file.filename;
    }

    issue.timeline.push(timelineEntry);

    // Calculate resolution time if resolved
    if (status === ISSUE_STATUS.RESOLVED || status === ISSUE_STATUS.CLOSED) {
      const timeDiff = Date.now() - issue.createdAt;
      issue.resolutionTime = Math.round(timeDiff / (1000 * 60 * 60)); // in hours

      if (status === ISSUE_STATUS.CLOSED) {
        issue.closedAt = new Date();
      }
    }

    await issue.save();

    // 🔔 SEND REAL-TIME NOTIFICATIONS
    const io = req.app.get("io");
    const NotificationService = require("../utils/notificationService");
    const notificationService = new NotificationService(io);

    // Send status update notification
    notificationService.notifyStatusUpdate(
      issue,
      req.user,
      issue.citizen,
      oldStatus,
      status,
    );

    // If resolved, send special resolved notification
    if (status === ISSUE_STATUS.RESOLVED) {
      notificationService.notifyIssueResolved(issue, req.user, issue.citizen);
    }

    req.flash("success", `Issue status updated to ${status}`);
    res.redirect(`/authority/issue/${issue._id}`);
  } catch (error) {
    console.error("Update Status Error:", error);
    req.flash("error", "Failed to update status");
    res.redirect("/authority/manage-issues");
  }
};
