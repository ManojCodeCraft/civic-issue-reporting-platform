const Issue = require("../models/Issue");
const User = require("../models/User");
const SLA = require("../models/SLA");
const {
  ISSUE_STATUS,
  ISSUE_CATEGORIES,
  USER_ROLES,
  SLA_DEFAULTS,
} = require("../utils/constants");

// @desc    Show admin dashboard
// @route   GET /admin/dashboard
exports.showDashboard = async (req, res) => {
  try {
    // Overall statistics
    const totalIssues = await Issue.countDocuments();
    const resolvedIssues = await Issue.countDocuments({
      status: ISSUE_STATUS.RESOLVED,
    });
    const overdueIssues = await Issue.countDocuments({
      isOverdue: true,
      status: { $nin: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
    });
    const totalUsers = await User.countDocuments();

    // Priority-based statistics
    const criticalIssues = await Issue.countDocuments({
      priority: "Critical",
      status: { $nin: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
    });

    const highPriorityIssues = await Issue.countDocuments({
      priority: "High",
      status: { $nin: [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED] },
    });

    // Category-wise breakdown
    const categoryStats = await Issue.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $eq: ["$status", ISSUE_STATUS.RESOLVED] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Status-wise breakdown
    const statusStats = await Issue.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Priority distribution
    const priorityStats = await Issue.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    // Fetch all authorities for assignment dropdown
    const authorities = await User.find({
      role: USER_ROLES.AUTHORITY,
      isActive: true,
    }).select("name department email");

    // Recent issues - SORTED BY PRIORITY (Critical first)
    const priorityOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };

    const recentIssues = await Issue.find()
      .populate("citizen", "name email")
      .populate("assignedTo", "name department")
      .sort({
        isOverdue: -1, // Overdue first
        priority: 1, // Then by priority
        createdAt: -1, // Then by newest
      })
      .limit(15);

    // Sort by custom priority order
    recentIssues.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return b.isOverdue - a.isOverdue;
      return (
        (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5)
      );
    });

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
    };

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      user: req.user,
      stats: {
        totalIssues,
        resolvedIssues,
        overdueIssues,
        totalUsers,
        criticalIssues,
        highPriorityIssues,
        resolutionRate:
          totalIssues > 0
            ? Math.round((resolvedIssues / totalIssues) * 100)
            : 0,
      },
      categoryStats,
      statusStats,
      priorityStats,
      recentIssues,
      authorities,
      slaCompliance,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);
    req.flash("error", "Failed to load dashboard");
    res.redirect("/");
  }
};

// @desc    Manage users
// @route   GET /admin/manage-users
exports.manageUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    let filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    const userStats = {
      total: await User.countDocuments(),
      citizens: await User.countDocuments({ role: USER_ROLES.CITIZEN }),
      authorities: await User.countDocuments({ role: USER_ROLES.AUTHORITY }),
      admins: await User.countDocuments({ role: USER_ROLES.ADMIN }),
    };

    res.render("admin/manage-users", {
      title: "Manage Users",
      user: req.user,
      users,
      userStats,
      roles: USER_ROLES,
      currentFilter: { role, search },
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Manage Users Error:", error);
    req.flash("error", "Failed to load users");
    res.redirect("/admin/dashboard");
  }
};

// @desc    Assign issue to authority
// @route   POST /admin/assign-issue/:id
exports.assignIssue = async (req, res) => {
  try {
    const { authorityId } = req.body;

    if (!authorityId) {
      req.flash("error", "Please select an authority");
      return res.redirect("/admin/dashboard");
    }

    const issue = await Issue.findById(req.params.id).populate(
      "citizen",
      "name email",
    );
    const authority = await User.findOne({
      _id: authorityId,
      role: USER_ROLES.AUTHORITY,
      isActive: true,
    });

    if (!issue) {
      req.flash("error", "Issue not found");
      return res.redirect("/admin/dashboard");
    }

    if (!authority) {
      req.flash("error", "Authority not found or inactive");
      return res.redirect("/admin/dashboard");
    }

    // Check if already assigned to the same authority
    if (issue.assignedTo && issue.assignedTo.equals(authorityId)) {
      req.flash("error", "Issue is already assigned to this authority");
      return res.redirect(`/admin/issue/${issue._id}`);
    }

    // Update assignment
    const wasAssigned = issue.assignedTo ? true : false;
    issue.assignedTo = authorityId;

    // Update status to Verified if it's first assignment
    if (!wasAssigned) {
      issue.status = ISSUE_STATUS.VERIFIED;
    }

    // Add to timeline
    issue.timeline.push({
      status: wasAssigned ? issue.status : ISSUE_STATUS.VERIFIED,
      updatedBy: req.user._id,
      remarks: wasAssigned
        ? `Reassigned to ${authority.name} (${authority.department})`
        : `Assigned to ${authority.name} (${authority.department})`,
    });

    await issue.save();

    // 🔔 SEND REAL-TIME NOTIFICATION
    const io = req.app.get("io");
    const NotificationService = require("../utils/notificationService");
    const notificationService = new NotificationService(io);

    notificationService.notifyIssueAssigned(issue, authority, issue.citizen);

    req.flash(
      "success",
      `Issue ${issue.issueId} ${wasAssigned ? "reassigned" : "assigned"} to ${authority.name}`,
    );

    // Redirect back to referrer or dashboard
    const referrer = req.get("Referrer");
    if (referrer && referrer.includes("/admin/issue/")) {
      res.redirect(`/admin/issue/${issue._id}`);
    } else {
      res.redirect("/admin/dashboard");
    }
  } catch (error) {
    console.error("Assign Issue Error:", error);
    req.flash("error", "Failed to assign issue");
    res.redirect("/admin/dashboard");
  }
};
// @desc    View issue details (admin)
// @route   GET /admin/issue/:id
exports.viewIssueDetail = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate("citizen", "name email phone address")
      .populate("assignedTo", "name department email")
      .populate("timeline.updatedBy", "name role");

    if (!issue) {
      req.flash("error", "Issue not found");
      return res.redirect("/admin/dashboard");
    }

    issue.checkOverdue();

    // Get all authorities for reassignment
    const authorities = await User.find({
      role: USER_ROLES.AUTHORITY,
      isActive: true,
    }).select("name department email");

    res.render("admin/issue-detail", {
      title: `Issue ${issue.issueId}`,
      user: req.user,
      issue,
      authorities,
      statuses: ISSUE_STATUS,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("View Issue Detail Error:", error);
    req.flash("error", "Failed to load issue details");
    res.redirect("/admin/dashboard");
  }
};

// @desc    Show SLA settings
// @route   GET /admin/sla-settings
exports.showSLASettings = async (req, res) => {
  try {
    const slaSettings = await SLA.find().populate("updatedBy", "name");

    // Merge with defaults
    const categories = Object.keys(ISSUE_CATEGORIES);
    const slaData = categories.map((key) => {
      const category = ISSUE_CATEGORIES[key];
      const existing = slaSettings.find((s) => s.category === category);

      return {
        category,
        durationInDays: existing
          ? existing.durationInDays
          : SLA_DEFAULTS[category],
        updatedBy: existing ? existing.updatedBy : null,
        isCustom: !!existing,
      };
    });

    res.render("admin/sla-settings", {
      title: "SLA Settings",
      user: req.user,
      slaData,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("SLA Settings Error:", error);
    req.flash("error", "Failed to load SLA settings");
    res.redirect("/admin/dashboard");
  }
};

// @desc    Update SLA setting
// @route   POST /admin/update-sla
exports.updateSLA = async (req, res) => {
  try {
    const { category, durationInDays } = req.body;

    if (!category || !durationInDays || durationInDays < 1) {
      req.flash("error", "Invalid SLA data");
      return res.redirect("/admin/sla-settings");
    }

    await SLA.findOneAndUpdate(
      { category },
      {
        category,
        durationInDays: parseInt(durationInDays),
        updatedBy: req.user._id,
      },
      { upsert: true, new: true },
    );

    req.flash("success", `SLA updated for ${category}`);
    res.redirect("/admin/sla-settings");
  } catch (error) {
    console.error("Update SLA Error:", error);
    req.flash("error", "Failed to update SLA");
    res.redirect("/admin/sla-settings");
  }
};

// @desc    Toggle user active status
// @route   POST /admin/toggle-user/:id
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/admin/manage-users");
    }

    if (user._id.equals(req.user._id)) {
      req.flash("error", "Cannot deactivate your own account");
      return res.redirect("/admin/manage-users");
    }

    user.isActive = !user.isActive;
    await user.save();

    req.flash(
      "success",
      `User ${user.isActive ? "activated" : "deactivated"} successfully`,
    );
    res.redirect("/admin/manage-users");
  } catch (error) {
    console.error("Toggle User Status Error:", error);
    req.flash("error", "Failed to update user status");
    res.redirect("/admin/manage-users");
  }
};
