/**
 * Notification Service for Real-time Updates
 * Handles all Socket.io emissions for different events
 */

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Notify when a new issue is created
   */
  notifyNewIssue(issue, citizenData) {
    // Notify all admins
    this.io.to("role:admin").emit("new_issue", {
      type: "new_issue",
      title: "🆕 New Issue Reported",
      message: `${citizenData.name} reported: ${issue.category}`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        category: issue.category,
        priority: issue.priority,
        description: issue.description.substring(0, 100),
        citizen: citizenData.name,
        createdAt: issue.createdAt,
      },
      timestamp: new Date(),
      link: `/admin/dashboard`,
    });

    console.log(`📢 Notification sent: New issue ${issue.issueId}`);
  }

  /**
   * Notify when an issue is assigned to an authority
   */
  notifyIssueAssigned(issue, authority, citizen) {
    // Notify the authority
    this.io.to(`user:${authority._id}`).emit("issue_assigned", {
      type: "issue_assigned",
      title: "📋 New Issue Assigned",
      message: `You have been assigned issue ${issue.issueId}`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        category: issue.category,
        priority: issue.priority,
        description: issue.description.substring(0, 100),
        citizen: citizen.name,
        location: issue.location.address,
      },
      timestamp: new Date(),
      link: `/authority/issue/${issue._id}`,
      sound: true,
    });

    // Notify the citizen
    this.io.to(`user:${citizen._id}`).emit("issue_updated", {
      type: "issue_assigned",
      title: "✅ Issue Assigned",
      message: `Your issue ${issue.issueId} has been assigned to ${authority.name}`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        status: issue.status,
        assignedTo: authority.name,
        department: authority.department,
      },
      timestamp: new Date(),
      link: `/citizen/issue/${issue._id}`,
    });

    console.log(
      `📢 Notification sent: Issue ${issue.issueId} assigned to ${authority.name}`,
    );
  }

  /**
   * Notify when issue status is updated
   */
  notifyStatusUpdate(issue, authority, citizen, oldStatus, newStatus) {
    // Notify the citizen
    this.io.to(`user:${citizen._id}`).emit("status_update", {
      type: "status_update",
      title: `🔄 Status Updated: ${newStatus}`,
      message: `Your issue ${issue.issueId} status changed from ${oldStatus} to ${newStatus}`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        oldStatus: oldStatus,
        newStatus: newStatus,
        category: issue.category,
        updatedBy: authority.name,
      },
      timestamp: new Date(),
      link: `/citizen/issue/${issue._id}`,
      sound: true,
    });

    // Notify admins
    this.io.to("role:admin").emit("issue_updated", {
      type: "status_update",
      title: "🔄 Issue Status Updated",
      message: `${authority.name} updated issue ${issue.issueId} to ${newStatus}`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        status: newStatus,
        category: issue.category,
      },
      timestamp: new Date(),
      link: `/admin/issue/${issue._id}`,
    });

    console.log(`📢 Notification sent: Status updated for ${issue.issueId}`);
  }

  /**
   * Notify when issue is resolved
   */
  notifyIssueResolved(issue, authority, citizen) {
    // Notify the citizen
    this.io.to(`user:${citizen._id}`).emit("issue_resolved", {
      type: "issue_resolved",
      title: "✅ Issue Resolved!",
      message: `Great news! Your issue ${issue.issueId} has been resolved`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        category: issue.category,
        resolutionTime: issue.resolutionTime,
        resolvedBy: authority.name,
      },
      timestamp: new Date(),
      link: `/citizen/issue/${issue._id}`,
      sound: true,
      celebration: true,
    });

    console.log(`📢 Notification sent: Issue ${issue.issueId} resolved`);
  }

  /**
   * Notify when issue is overdue
   */
  notifyOverdue(issue, authority) {
    // Notify the authority
    this.io.to(`user:${authority._id}`).emit("issue_overdue", {
      type: "issue_overdue",
      title: "⚠️ Issue Overdue!",
      message: `Issue ${issue.issueId} has exceeded its SLA deadline`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        category: issue.category,
        priority: issue.priority,
        slaDeadline: issue.slaDeadline,
      },
      timestamp: new Date(),
      link: `/authority/issue/${issue._id}`,
      sound: true,
      urgent: true,
    });

    // Notify admins
    this.io.to("role:admin").emit("issue_overdue", {
      type: "issue_overdue",
      title: "⚠️ SLA Violation",
      message: `Issue ${issue.issueId} assigned to ${authority.name} is overdue`,
      issue: {
        id: issue._id,
        issueId: issue.issueId,
        category: issue.category,
        priority: issue.priority,
        assignedTo: authority.name,
      },
      timestamp: new Date(),
      link: `/admin/issue/${issue._id}`,
      urgent: true,
    });

    console.log(`📢 Notification sent: Issue ${issue.issueId} is overdue`);
  }

  /**
   * Broadcast dashboard update to all users of a role
   */
  broadcastDashboardUpdate(role, data) {
    this.io.to(`role:${role}`).emit("dashboard_update", {
      type: "dashboard_update",
      data: data,
      timestamp: new Date(),
    });

    console.log(`📢 Dashboard update sent to ${role}`);
  }

  /**
   * Send custom notification to specific user
   */
  sendNotification(userId, notification) {
    this.io.to(`user:${userId}`).emit("notification", {
      ...notification,
      timestamp: new Date(),
    });

    console.log(`📢 Custom notification sent to user ${userId}`);
  }
}

module.exports = NotificationService;
