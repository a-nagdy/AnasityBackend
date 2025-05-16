import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

/**
 * Connect to MongoDB and remove sequentialId fields from all collections
 */
async function main() {
  console.log("Connecting to MongoDB...");

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB successfully!");

    // Get all collections in the database
    const collections = await mongoose.connection.db.collections();

    for (const collection of collections) {
      const collectionName = collection.collectionName;

      // Skip system collections
      if (collectionName.startsWith("system.")) {
        continue;
      }

      console.log(`Processing collection: ${collectionName}`);

      try {
        // 1. Drop the sequentialId index if it exists
        try {
          await collection.dropIndex("sequentialId_1");
          console.log(`Dropped sequentialId index from ${collectionName}`);
        } catch (indexError) {
          // Index might not exist, that's fine
          console.log(`No sequentialId index to drop in ${collectionName}`);
        }

        // 2. Update all documents to remove the sequentialId field
        const updateResult = await collection.updateMany(
          {}, // Match all documents
          { $unset: { sequentialId: "" } } // Remove sequentialId field
        );

        console.log(
          `Updated ${updateResult.modifiedCount} documents in ${collectionName}`
        );
      } catch (collectionError) {
        console.error(`Error processing ${collectionName}:`, collectionError);
      }
    }

    // Also delete the Counter collection if it exists
    try {
      await mongoose.connection.db.dropCollection("counters");
      console.log("Dropped the counters collection");
    } catch (error) {
      console.log("No counters collection to drop");
    }

    console.log("\nAll done! SequentialId fields have been removed.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the script
main().catch(console.error);
