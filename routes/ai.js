const express = require("express");
const router = express.Router();
const aiClassifier = require("../utils/aiClassifier");

// @desc    Analyze issue description with AI
// @route   POST /api/ai/analyze
router.post("/analyze", (req, res) => {
  try {
    const { description, category } = req.body;

    if (!description || description.trim().length < 10) {
      return res.json({
        success: false,
        message: "Description must be at least 10 characters",
      });
    }

    const analysis = aiClassifier.analyzeIssue(description, category);

    res.json({
      success: true,
      analysis: analysis,
    });
  } catch (error) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze issue",
      error: error.message,
    });
  }
});

// @desc    Get category suggestions
// @route   POST /api/ai/suggest-category
router.post("/suggest-category", (req, res) => {
  try {
    const { description } = req.body;

    if (!description || description.trim().length < 5) {
      return res.json({
        success: false,
        message: "Description too short for classification",
      });
    }

    const classification = aiClassifier.classifyCategory(description);

    res.json({
      success: true,
      suggestion: classification,
    });
  } catch (error) {
    console.error("Category Suggestion Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to suggest category",
      error: error.message,
    });
  }
});

// @desc    Analyze sentiment only
// @route   POST /api/ai/sentiment
router.post("/sentiment", (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.json({
        success: false,
        message: "Description is required",
      });
    }

    const sentiment = aiClassifier.analyzeSentiment(description);

    res.json({
      success: true,
      sentiment: sentiment,
    });
  } catch (error) {
    console.error("Sentiment Analysis Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze sentiment",
      error: error.message,
    });
  }
});

module.exports = router;
