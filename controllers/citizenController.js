const Issue = require("../models/Issue");
const { calculateSLADeadline } = require("../utils/slaCalculator");
const { analyzeIssue } = require("../utils/aiClassifier");
const { ISSUE_STATUS, ISSUE_CATEGORIES } = require("../utils/constants");

// @desc    Show citizen dashboard
// @route   GET /citizen/dashboard
exports.showDashboard = async (req, res) => {
  try {
    const issues = await Issue.find({ citizen: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    const stats = {
      total: await Issue.countDocuments({ citizen: req.user._id }),
      reported: await Issue.countDocuments({
        citizen: req.user._id,
        status: ISSUE_STATUS.REPORTED,
      }),
      inProgress: await Issue.countDocuments({
        citizen: req.user._id,
        status: ISSUE_STATUS.IN_PROGRESS,
      }),
      resolved: await Issue.countDocuments({
        citizen: req.user._id,
        status: ISSUE_STATUS.RESOLVED,
      }),
    };

    res.render("citizen/dashboard", {
      title: "Citizen Dashboard",
      user: req.user,
      issues,
      stats,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    req.flash("error", "Failed to load dashboard");
    res.redirect("/");
  }
};

// @desc    Show submit issue page
// @route   GET /citizen/submit-issue
exports.showSubmitIssuePage = (req, res) => {
  res.render("citizen/submit-issue", {
    title: "Submit Issue",
    user: req.user,
    categories: ISSUE_CATEGORIES,
    error: req.flash("error"),
    success: req.flash("success"),
  });
};

// @desc    Submit new issue
// @route   POST /citizen/submit-issue
exports.submitIssue = async (req, res) => {
  try {
    const { category, description, address, latitude, longitude, priority } =
      req.body;

    // Validate required fields
    if (!category || !description || !address) {
      req.flash("error", "Please fill in all required fields");
      return res.redirect("/citizen/submit-issue");
    }

    // Validate coordinates
    if (!latitude || !longitude) {
      req.flash(
        "error",
        "Location coordinates are required. Please enable location or enter coordinates manually.",
      );
      return res.redirect("/citizen/submit-issue");
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      req.flash("error", "Invalid coordinates. Please check and try again.");
      return res.redirect("/citizen/submit-issue");
    }

    // Perform AI analysis
    const aiAnalysis = analyzeIssue(description, category);
    console.log("AI Analysis:", aiAnalysis);

    // Calculate SLA deadline
    const slaDeadline = await calculateSLADeadline(category);

    // Create issue data object
    const issueData = {
      category,
      description,
      location: {
        address,
        coordinates: {
          type: "Point",
          coordinates: [lng, lat],
        },
        latitude: lat,
        longitude: lng,
      },
      citizen: req.user._id,
      slaDeadline,
      status: "Reported",
      priority: priority || aiAnalysis.priority,
      aiAnalysis: {
        suggestedCategory: aiAnalysis.suggestedCategory,
        categoryConfidence: aiAnalysis.categoryConfidence,
        sentiment: aiAnalysis.sentiment,
        sentimentScore: aiAnalysis.sentimentScore,
        urgency: aiAnalysis.urgency,
        priorityScore: aiAnalysis.priorityScore,
        keywords: aiAnalysis.keywords,
        analyzedAt: new Date(),
      },
      timeline: [
        {
          status: "Reported",
          updatedBy: req.user._id,
          remarks: `Issue reported by citizen | AI Priority: ${aiAnalysis.priority} | Urgency: ${aiAnalysis.urgency}`,
          timestamp: new Date(),
        },
      ],
    };

    // Add photo if uploaded
    if (req.file) {
      issueData.photo = "/uploads/" + req.file.filename;
    }

    console.log("Creating issue with AI-enhanced data");

    // Create the issue
    const issue = new Issue(issueData);
    await issue.save();

    console.log("Issue created successfully:", issue.issueId);

    // 🔔 SEND REAL-TIME NOTIFICATION
    const io = req.app.get("io");
    const NotificationService = require("../utils/notificationService");
    const notificationService = new NotificationService(io);

    notificationService.notifyNewIssue(issue, {
      name: req.user.name,
      email: req.user.email,
    });

    req.flash(
      "success",
      `✨ Issue submitted successfully! Issue ID: ${issue.issueId} | AI Priority: ${aiAnalysis.priority}`,
    );
    res.redirect("/citizen/view-issues");
  } catch (error) {
    console.error("Submit Issue Error:", error);
    req.flash(
      "error",
      error.message || "Failed to submit issue. Please try again.",
    );
    res.redirect("/citizen/submit-issue");
  }
};

// @desc    View all issues by citizen
// @route   GET /citizen/view-issues
exports.viewIssues = async (req, res) => {
  try {
    const { status, category } = req.query;

    let filter = { citizen: req.user._id };

    if (status) filter.status = status;
    if (category) filter.category = category;

    const issues = await Issue.find(filter)
      .populate("assignedTo", "name department")
      .sort({ createdAt: -1 });

    // Check for overdue issues
    issues.forEach((issue) => issue.checkOverdue());

    res.render("citizen/view-issues", {
      title: "My Issues",
      user: req.user,
      issues,
      categories: ISSUE_CATEGORIES,
      statuses: ISSUE_STATUS,
      currentFilter: { status, category },
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("View Issues Error:", error);
    req.flash("error", "Failed to load issues");
    res.redirect("/citizen/dashboard");
  }
};

// @desc    View single issue detail
// @route   GET /citizen/issue/:id
exports.viewIssueDetail = async (req, res) => {
  try {
    const issue = await Issue.findOne({
      _id: req.params.id,
      citizen: req.user._id,
    })
      .populate("citizen", "name email phone")
      .populate("assignedTo", "name department email")
      .populate("timeline.updatedBy", "name role");

    if (!issue) {
      req.flash("error", "Issue not found");
      return res.redirect("/citizen/view-issues");
    }

    issue.checkOverdue();

    res.render("citizen/issue-detail", {
      title: `Issue ${issue.issueId}`,
      user: req.user,
      issue,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("View Issue Detail Error:", error);
    req.flash("error", "Failed to load issue details");
    res.redirect("/citizen/view-issues");
  }
};
