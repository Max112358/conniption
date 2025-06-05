// backend/utils/scheduledJobs.js
const housekeepingService = require("../services/housekeeping");

/**
 * Scheduled jobs manager
 */
class ScheduledJobs {
  constructor() {
    this.intervals = {};
    this.lastRun = {};
    this.isRunning = false;
    this.isInitialized = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    console.log("Scheduled Jobs: Starting all scheduled jobs");

    // Don't run housekeeping immediately on startup - wait for first interval
    // This gives the database time to initialize
    console.log("Scheduled Jobs: Housekeeping will run in 1 hour");

    // Schedule housekeeping to run every hour
    this.intervals.housekeeping = setInterval(() => {
      this.runHousekeeping();
    }, 60 * 60 * 1000); // 1 hour

    // Mark as initialized
    this.isInitialized = true;

    console.log("Scheduled Jobs: All jobs scheduled");
  }

  /**
   * Run housekeeping immediately (for manual trigger)
   */
  async runHousekeepingNow() {
    if (!this.isInitialized) {
      throw new Error("Scheduled jobs not initialized yet");
    }
    return this.runHousekeeping();
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log("Scheduled Jobs: Stopping all scheduled jobs");

    Object.keys(this.intervals).forEach((jobName) => {
      if (this.intervals[jobName]) {
        clearInterval(this.intervals[jobName]);
        delete this.intervals[jobName];
      }
    });

    this.isInitialized = false;
    console.log("Scheduled Jobs: All jobs stopped");
  }

  /**
   * Run housekeeping tasks
   */
  async runHousekeeping() {
    // Prevent concurrent runs
    if (this.isRunning) {
      console.log("Scheduled Jobs: Housekeeping already running, skipping");
      return;
    }

    console.log("Scheduled Jobs: Running housekeeping");
    const startTime = Date.now();
    this.isRunning = true;

    try {
      this.lastRun.housekeeping = new Date();
      const results = await housekeepingService.runAllTasks();

      const duration = Date.now() - startTime;
      console.log(
        `Scheduled Jobs: Housekeeping completed in ${duration}ms`,
        JSON.stringify(results, null, 2)
      );

      return results;
    } catch (error) {
      console.error("Scheduled Jobs: Error running housekeeping:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus() {
    const status = {
      initialized: this.isInitialized,
      jobs: {},
    };

    Object.keys(this.intervals).forEach((jobName) => {
      status.jobs[jobName] = {
        running: !!this.intervals[jobName],
        lastRun: this.lastRun[jobName] || null,
      };
    });

    // Add housekeeping status even if interval hasn't been created yet
    if (!status.jobs.housekeeping) {
      status.jobs.housekeeping = {
        running: this.isInitialized,
        lastRun: this.lastRun.housekeeping || null,
      };
    }

    return status;
  }
}

// Create singleton instance
const scheduledJobs = new ScheduledJobs();

module.exports = scheduledJobs;
