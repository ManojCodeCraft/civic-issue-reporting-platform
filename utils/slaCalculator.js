const SLA = require("../models/SLA");
const { SLA_DEFAULTS } = require("./constants");

const calculateSLADeadline = async (category) => {
  try {
    // Try to find custom SLA setting
    const slaSetting = await SLA.findOne({ category });

    const durationInDays = slaSetting
      ? slaSetting.durationInDays
      : SLA_DEFAULTS[category] || 7;

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + durationInDays);

    return deadline;
  } catch (error) {
    console.error("SLA Calculation Error:", error);
    // Default to 7 days if error
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    return deadline;
  }
};

module.exports = { calculateSLADeadline };
