const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const adminExists = await User.findOne({ role: "admin" });

    if (adminExists) {
      console.log("Admin already exists");
      process.exit(0);
    }

    const admin = await User.create({
      name: "System Administrator",
      email: "admin@civictrack.com",
      password: "admin123",
      phone: "1234567890",
      role: "admin",
    });

    console.log("Admin created successfully!");
    console.log("Email: admin@civictrack.com");
    console.log("Password: admin123");
    console.log("Please change the password after first login!");

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

createAdmin();
