const natural = require("natural");
const sentiment = require("sentiment");
const keyword = require("keyword-extractor");

// Initialize sentiment analyzer
const sentimentAnalyzer = new sentiment();

// Initialize classifier
const classifier = new natural.BayesClassifier();

// Training data for issue categories
const trainingData = {
  "Road Damage": [
    "pothole",
    "road",
    "street",
    "highway",
    "pavement",
    "crack",
    "broken road",
    "damaged road",
    "road repair",
    "asphalt",
    "bump",
    "uneven road",
    "road hole",
    "crater",
    "road surface",
    "path",
    "footpath",
    "sidewalk",
    "curb",
    "traffic",
  ],
  "Waste Management": [
    "garbage",
    "trash",
    "waste",
    "rubbish",
    "dump",
    "litter",
    "dustbin",
    "bin",
    "cleanliness",
    "dirty",
    "filth",
    "smell",
    "stink",
    "cleanup",
    "sweeping",
    "sanitation",
    "refuse",
    "disposal",
    "plastic",
    "decompose",
  ],
  "Water Supply": [
    "water",
    "tap",
    "pipeline",
    "leak",
    "supply",
    "drinking water",
    "pipe burst",
    "no water",
    "water shortage",
    "contaminated",
    "dirty water",
    "water pressure",
    "tank",
    "bore",
    "well",
    "valve",
    "faucet",
    "plumbing",
    "sewage",
  ],
  "Street Lighting": [
    "light",
    "lamp",
    "streetlight",
    "dark",
    "bulb",
    "electricity",
    "lighting",
    "illumination",
    "night",
    "pole",
    "street lamp",
    "light post",
    "broken light",
    "not working",
    "dim",
    "flickering",
    "power",
  ],
  Drainage: [
    "drain",
    "drainage",
    "sewer",
    "clog",
    "block",
    "overflow",
    "flood",
    "waterlogging",
    "stagnant",
    "manhole",
    "gutter",
    "canal",
    "rainwater",
    "sewage",
    "blocked drain",
    "water accumulation",
    "monsoon",
  ],
  "Parks & Gardens": [
    "park",
    "garden",
    "tree",
    "plant",
    "grass",
    "playground",
    "bench",
    "green",
    "maintenance",
    "pruning",
    "hedge",
    "flower",
    "lawn",
    "bush",
    "recreational",
    "children play",
    "swing",
    "slide",
  ],
  Other: ["other", "miscellaneous", "general", "complaint", "issue", "problem"],
};

// Train the classifier
function trainClassifier() {
  Object.keys(trainingData).forEach((category) => {
    trainingData[category].forEach((keyword) => {
      // Train with individual keywords
      classifier.addDocument(keyword, category);

      // Train with keyword combinations
      classifier.addDocument(`${keyword} problem`, category);
      classifier.addDocument(`${keyword} issue`, category);
      classifier.addDocument(`broken ${keyword}`, category);
      classifier.addDocument(`damaged ${keyword}`, category);
    });
  });

  classifier.train();
  console.log("✅ AI Classifier trained successfully");
}

// Initialize training
trainClassifier();

/**
 * Classify issue category based on description
 * @param {string} description - Issue description
 * @returns {object} - Classification result with category and confidence
 */
function classifyCategory(description) {
  if (!description || description.trim().length === 0) {
    return { category: "Other", confidence: 0.5 };
  }

  const text = description.toLowerCase();

  // Get classification
  const classifications = classifier.getClassifications(text);
  const topMatch = classifications[0];

  // Extract keywords for better matching
  const keywords = keyword.extract(text, {
    language: "english",
    remove_digits: false,
    return_changed_case: true,
    remove_duplicates: true,
  });

  // Score each category based on keyword matches
  const categoryScores = {};
  Object.keys(trainingData).forEach((category) => {
    let score = 0;
    trainingData[category].forEach((term) => {
      if (text.includes(term)) {
        score += 2;
      }
      if (keywords.includes(term)) {
        score += 1;
      }
    });
    categoryScores[category] = score;
  });

  // Find best match from keyword scoring
  const bestKeywordMatch = Object.keys(categoryScores).reduce((a, b) =>
    categoryScores[a] > categoryScores[b] ? a : b,
  );

  // Combine both methods
  let finalCategory = topMatch.label;
  let confidence = topMatch.value;

  if (categoryScores[bestKeywordMatch] > 3) {
    finalCategory = bestKeywordMatch;
    confidence = Math.min(0.95, confidence + 0.2);
  }

  return {
    category: finalCategory,
    confidence: Math.round(confidence * 100),
    alternativeCategories: classifications.slice(1, 3).map((c) => ({
      category: c.label,
      confidence: Math.round(c.value * 100),
    })),
  };
}

/**
 * Analyze sentiment and detect urgency
 * @param {string} description - Issue description
 * @returns {object} - Sentiment analysis result
 */
function analyzeSentiment(description) {
  if (!description || description.trim().length === 0) {
    return { score: 0, sentiment: "neutral", urgency: "Medium" };
  }

  const result = sentimentAnalyzer.analyze(description);

  // Urgency keywords
  const urgentWords = [
    "urgent",
    "emergency",
    "immediate",
    "critical",
    "danger",
    "dangerous",
    "serious",
    "severe",
    "very bad",
    "terrible",
    "horrible",
    "worst",
    "asap",
    "quickly",
    "fast",
    "now",
    "help",
    "please help",
    "major",
  ];

  const text = description.toLowerCase();
  let urgencyScore = 0;

  urgentWords.forEach((word) => {
    if (text.includes(word)) {
      urgencyScore += 2;
    }
  });

  // Combine sentiment score and urgency keywords
  let sentiment = "neutral";
  let urgency = "Medium";

  if (result.score <= -3) sentiment = "very negative";
  else if (result.score < 0) sentiment = "negative";
  else if (result.score === 0) sentiment = "neutral";
  else if (result.score <= 3) sentiment = "positive";
  else sentiment = "very positive";

  // Determine urgency
  if (urgencyScore >= 4 || result.score <= -5) {
    urgency = "Critical";
  } else if (urgencyScore >= 2 || result.score <= -3) {
    urgency = "High";
  } else if (urgencyScore === 0 && result.score >= 0) {
    urgency = "Low";
  }

  return {
    score: result.score,
    sentiment: sentiment,
    urgency: urgency,
    urgencyScore: urgencyScore,
    comparative: result.comparative,
  };
}

/**
 * Calculate priority score based on multiple factors
 * @param {string} description - Issue description
 * @param {string} category - Issue category
 * @returns {object} - Priority analysis
 */
function calculatePriority(description, category) {
  const sentimentResult = analyzeSentiment(description);

  // Base priority scores for categories
  const categoryPriority = {
    "Water Supply": 4,
    Drainage: 3,
    "Road Damage": 3,
    "Street Lighting": 2,
    "Waste Management": 2,
    "Parks & Gardens": 1,
    Other: 2,
  };

  let baseScore = categoryPriority[category] || 2;

  // Adjust based on urgency
  if (sentimentResult.urgency === "Critical") baseScore += 3;
  else if (sentimentResult.urgency === "High") baseScore += 2;
  else if (sentimentResult.urgency === "Low") baseScore -= 1;

  // Normalize to priority levels
  let priority = "Medium";
  if (baseScore >= 6) priority = "Critical";
  else if (baseScore >= 4) priority = "High";
  else if (baseScore <= 1) priority = "Low";

  return {
    priority: priority,
    score: baseScore,
    reasoning: {
      categoryWeight: categoryPriority[category] || 2,
      urgencyDetected: sentimentResult.urgency,
      sentimentScore: sentimentResult.score,
    },
  };
}

/**
 * Generate keywords for search and matching
 * @param {string} description - Issue description
 * @returns {array} - Keywords
 */
function generateKeywords(description) {
  try {
    const keywords = keyword.extract(description, {
      language: "english",
      remove_digits: false,
      return_changed_case: true,
      remove_duplicates: true,
    });
    return keywords.slice(0, 10);
  } catch (error) {
    console.log("Keyword extraction error:", error.message);
    return [];
  }
}

/**
 * Complete AI analysis of an issue
 * @param {string} description - Issue description
 * @param {string} providedCategory - User provided category (optional)
 * @returns {object} - Complete AI analysis
 */
function analyzeIssue(description, providedCategory = null) {
  try {
    const classification = classifyCategory(description);
    const finalCategory = providedCategory || classification.category;
    const sentimentResult = analyzeSentiment(description);
    const priorityResult = calculatePriority(description, finalCategory);
    const keywords = generateKeywords(description);

    return {
      suggestedCategory: classification.category,
      categoryConfidence: classification.confidence,
      alternativeCategories: classification.alternativeCategories,
      sentiment: sentimentResult.sentiment,
      sentimentScore: sentimentResult.score,
      urgency: sentimentResult.urgency,
      priority: priorityResult.priority,
      priorityScore: priorityResult.score,
      priorityReasoning: priorityResult.reasoning,
      keywords: keywords,
      analysis: {
        hasUrgentLanguage: sentimentResult.urgencyScore > 0,
        isNegative: sentimentResult.score < 0,
        needsImmediateAttention: priorityResult.priority === "Critical",
      },
    };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    // Return default analysis if error occurs
    return {
      suggestedCategory: providedCategory || "Other",
      categoryConfidence: 50,
      alternativeCategories: [],
      sentiment: "neutral",
      sentimentScore: 0,
      urgency: "Medium",
      priority: "Medium",
      priorityScore: 2,
      priorityReasoning: {
        categoryWeight: 2,
        urgencyDetected: "Medium",
        sentimentScore: 0,
      },
      keywords: [],
      analysis: {
        hasUrgentLanguage: false,
        isNegative: false,
        needsImmediateAttention: false,
      },
    };
  }
}

module.exports = {
  classifyCategory,
  analyzeSentiment,
  calculatePriority,
  analyzeIssue,
  generateKeywords,
  trainClassifier,
};
