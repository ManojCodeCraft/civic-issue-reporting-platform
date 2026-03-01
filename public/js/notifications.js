/**
 * Real-time Notifications Client
 */

class NotificationManager {
  constructor() {
    this.socket = null;
    this.notifications = [];
    this.maxNotifications = 50;
    this.init();
  }

  init() {
    // Connect to Socket.io
    this.socket = io();

    // Get user data from page
    const userDataElement = document.getElementById("userData");
    if (userDataElement) {
      const userId = userDataElement.dataset.userId;
      const role = userDataElement.dataset.role;

      if (userId && role) {
        // Join user's room
        this.socket.emit("join", { userId, role });
        console.log("🔌 Connected to notifications");
      }
    }

    // Listen for all notification types
    this.socket.on("new_issue", (data) => this.handleNotification(data));
    this.socket.on("issue_assigned", (data) => this.handleNotification(data));
    this.socket.on("issue_updated", (data) => this.handleNotification(data));
    this.socket.on("status_update", (data) => this.handleNotification(data));
    this.socket.on("issue_resolved", (data) => this.handleNotification(data));
    this.socket.on("issue_overdue", (data) => this.handleNotification(data));
    this.socket.on("notification", (data) => this.handleNotification(data));

    // Dashboard updates
    this.socket.on("dashboard_update", (data) =>
      this.handleDashboardUpdate(data),
    );

    // Create notification container
    this.createNotificationContainer();
  }

  createNotificationContainer() {
    if (document.getElementById("notificationContainer")) return;

    const container = document.createElement("div");
    container.id = "notificationContainer";
    container.className = "notification-container";
    document.body.appendChild(container);
  }

  handleNotification(data) {
    console.log("📬 Notification received:", data);

    // Add to notifications array
    this.notifications.unshift(data);
    if (this.notifications.length > this.maxNotifications) {
      this.notifications.pop();
    }

    // Show notification
    this.showNotification(data);

    // Play sound if specified
    if (data.sound) {
      this.playNotificationSound();
    }

    // Update notification badge
    this.updateNotificationBadge();
  }

  showNotification(data) {
    const notification = document.createElement("div");
    notification.className = `notification ${data.type || "info"} ${data.urgent ? "urgent" : ""}`;

    let icon = "📢";
    if (data.type === "new_issue") icon = "🆕";
    if (data.type === "issue_assigned") icon = "📋";
    if (data.type === "status_update") icon = "🔄";
    if (data.type === "issue_resolved") icon = "✅";
    if (data.type === "issue_overdue") icon = "⚠️";

    notification.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <div class="notification-title">${data.title}</div>
        <div class="notification-message">${data.message}</div>
        ${data.link ? `<a href="${data.link}" class="notification-link">View Details →</a>` : ""}
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    // Add celebration effect for resolved issues
    if (data.celebration) {
      notification.classList.add("celebration");
      this.triggerCelebration();
    }

    const container = document.getElementById("notificationContainer");
    container.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 10000);
  }

  playNotificationSound() {
    // Create and play a simple beep
    const audio = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUKrk8bllHAU2kdnyzHgrBSF3yPDek0IKEly16+upVhMJQ53f8r9vIgUsfM" +
        "71" +
        "3Ic1Bxhns+PYmUEIBCyEz/LEdiMEI4TO89yLOAgXZ7zv6qFLEwk9l9fxuXApBSR9y/LfkUALD1yy4+ynVRMJQZzd8rxuIgUsf8Ty34k1BxlnvPDkmEwND0+o5fG5ZBsENova8clyJQUhe8rx3o9ACg1bsfDqpVQTCUCa3fK8bSIFLH3E8t6KNAY=",
    );
    audio.volume = 0.3;
    audio.play().catch((e) => console.log("Sound play failed:", e));
  }

  triggerCelebration() {
    // Simple confetti effect
    const colors = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899"];
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const confetti = document.createElement("div");
        confetti.className = "confetti";
        confetti.style.left = Math.random() * 100 + "%";
        confetti.style.background =
          colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = Math.random() * 3 + 2 + "s";
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 5000);
      }, i * 30);
    }
  }

  updateNotificationBadge() {
    const badge = document.getElementById("notificationBadge");
    if (badge) {
      const unreadCount = this.notifications.filter((n) => !n.read).length;
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? "block" : "none";
    }
  }

  handleDashboardUpdate(data) {
    console.log("📊 Dashboard update received");
    // Optionally refresh specific dashboard components
    // This can trigger chart updates, stat refreshes, etc.
  }

  getNotifications() {
    return this.notifications;
  }

  markAsRead(index) {
    if (this.notifications[index]) {
      this.notifications[index].read = true;
      this.updateNotificationBadge();
    }
  }

  clearAll() {
    this.notifications = [];
    this.updateNotificationBadge();
    const container = document.getElementById("notificationContainer");
    if (container) {
      container.innerHTML = "";
    }
  }
}

// Initialize when DOM is ready
let notificationManager;
document.addEventListener("DOMContentLoaded", () => {
  notificationManager = new NotificationManager();
});
