const mongoose = require("mongoose");
const { ISSUE_STATUS, ISSUE_CATEGORIES } = require("../utils/constants");

const issueSchema = new mongoose.Schema(
  {
    issueId: {
      type: String,
      unique: true,
      required: true,
    },

    category: {
      type: String,
      enum: Object.values(ISSUE_CATEGORIES),
      required: [true, "Category is required"],
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: 10,
      maxlength: 1000,
    },

    location: {
      address: {
        type: String,
        required: true,
      },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
        },
      },

      // Legacy support
      latitude: Number,
      longitude: Number,
    },

    photo: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(ISSUE_STATUS),
      default: ISSUE_STATUS.REPORTED,
    },

    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    slaDeadline: {
      type: Date,
      required: true,
    },

    isOverdue: {
      type: Boolean,
      default: false,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },

    timeline: [
      {
        status: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        remarks: String,
        evidence: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    resolutionTime: {
      type: Number,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/* =========================
   INDEXES
========================= */

// Geospatial index
issueSchema.index({ "location.coordinates": "2dsphere" });

/* =========================
   MIDDLEWARE
========================= */

// Generate issueId before validation
issueSchema.pre("validate", async function () {
  if (this.isNew && !this.issueId) {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    this.issueId = `ISS${year}${random}`;
  }
});

// Ensure GeoJSON format
issueSchema.pre("save", function () {
  if (
    this.location &&
    this.location.latitude != null &&
    this.location.longitude != null
  ) {
    this.location.coordinates = {
      type: "Point",
      coordinates: [this.location.longitude, this.location.latitude],
    };
  }
});

/* =========================
   METHODS
========================= */

issueSchema.methods.checkOverdue = function () {
  if (
    this.status !== ISSUE_STATUS.CLOSED &&
    this.status !== ISSUE_STATUS.RESOLVED
  ) {
    this.isOverdue = new Date() > this.slaDeadline;
  }
  return this.isOverdue;
};

const Issue = mongoose.model("Issue", issueSchema);

module.exports = Issue;
