const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT Token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      req.flash("error", "Please login to access this page");
      return res.redirect("/auth/login");
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user || !req.user.isActive) {
      req.flash("error", "User not found or inactive");
      return res.redirect("/auth/login");
    }

    next();
  } catch (error) {
    req.flash("error", "Invalid or expired token");
    res.redirect("/auth/login");
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      req.flash("error", "You do not have permission to access this resource");
      return res.redirect("/");
    }
    next();
  };
};

module.exports = { protect, authorize };
