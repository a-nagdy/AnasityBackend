import dotenv from "dotenv";
import cron from "node-cron";
import { updateAllProductStatuses } from "../utils/productStatus.js";

// Load environment variables
dotenv.config();

/**
 * Schedule product status update to run every hour by default
 * Can be configured via environment variable PRODUCT_STATUS_CRON
 * Default schedule: '0 * * * *' (every hour at minute 0)
 */
const scheduleProductStatusUpdates = () => {
  const cronSchedule = process.env.PRODUCT_STATUS_CRON || "0 * * * *";

  console.log(`Scheduling product status updates: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    console.log("Running scheduled product status update...");

    try {
      const result = await updateAllProductStatuses();

      if (result.success) {
        console.log(
          `Product status update completed: ${result.updatedProducts} products updated`
        );
      } else {
        console.error("Product status update failed:", result.error);
      }
    } catch (error) {
      console.error("Error during scheduled product status update:", error);
    }
  });
};

export default scheduleProductStatusUpdates;
