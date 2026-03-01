const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Show registration page
// @route   GET /auth/register
exports.showRegisterPage = (req, res) => {
  res.render("auth/register", {
    title: "Register",
    error: req.flash("error"),
    success: req.flash("success"),
  });
};

// @desc    Register user
// @route   POST /auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role, address, department } =
      req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      req.flash("error", "Email already registered");
      return res.redirect("/auth/register");
    }

    // Create user
    const userData = {
      name,
      email,
      password,
      phone,
      role: role || "citizen",
    };

    if (role === "citizen") {
      userData.address = address;
    } else if (role === "authority") {
      userData.department = department;
    }

    const user = await User.create(userData);

    req.flash("success", "Registration successful! Please login.");
    res.redirect("/auth/login");
  } catch (error) {
    console.error("Registration Error:", error);
    req.flash("error", error.message || "Registration failed");
    res.redirect("/auth/register");
  }
};

// @desc    Show login page
// @route   GET /auth/login
exports.showLoginPage = (req, res) => {
  res.render("auth/login", {
    title: "Login",
    error: req.flash("error"),
    success: req.flash("success"),
  });
};

// @desc    Login user
// @route   POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      req.flash("error", "Invalid credentials or account inactive");
      return res.redirect("/auth/login");
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      req.flash("error", "Invalid credentials");
      return res.redirect("/auth/login");
    }

    // Generate token
    const token = generateToken(user._id);

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Redirect based on role
    if (user.role === "admin") {
      res.redirect("/admin/dashboard");
    } else if (user.role === "authority") {
      res.redirect("/authority/dashboard");
    } else {
      res.redirect("/citizen/dashboard");
    }
  } catch (error) {
    console.error("Login Error:", error);
    req.flash("error", "Login failed");
    res.redirect("/auth/login");
  }
};

// @desc    Logout user
// @route   GET /auth/logout
exports.logout = (req, res) => {
  res.clearCookie("token");
  req.flash("success", "Logged out successfully");
  res.redirect("/");
};
