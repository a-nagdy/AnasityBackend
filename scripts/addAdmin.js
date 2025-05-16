import dotenv from "dotenv";
import mongoose from "mongoose";
import readline from "readline";
import User from "../models/User/User.js";

// Load environment variables
dotenv.config();

// Create readline interface for interactive prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify the question method
const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

/**
 * Validate and select user role
 * @param {string} initialRole - Initial role value from command line
 * @returns {Promise<string>} - Validated role
 */
async function validateRole(initialRole) {
  const validRoles = ["customer", "admin", "super-admin"];

  // Initial role validation
  if (initialRole && validRoles.includes(initialRole)) {
    return initialRole;
  }

  // If role is invalid or not provided, ask interactively
  console.log("\nPlease select a role:");
  console.log("1. customer - Regular customer role");
  console.log("2. admin - Admin role with management privileges");
  console.log("3. super-admin - Super admin with all privileges");

  let selectedRole = "";
  while (!validRoles.includes(selectedRole)) {
    const answer = await question("Enter role number (1-3) or role name: ");

    // Check if input is a number
    if (answer === "1") selectedRole = "customer";
    else if (answer === "2") selectedRole = "admin";
    else if (answer === "3") selectedRole = "super-admin";
    // Check if input is a valid role name
    else if (validRoles.includes(answer)) selectedRole = answer;
    else console.log("Invalid selection. Please try again.");
  }

  return selectedRole;
}

/**
 * Add a new admin user to the database
 *
 * Usage:
 * node scripts/addAdmin.js [email] [password] [role] [firstName] [lastName]
 *
 * Default values if not provided:
 * - email: admin@anasity.com
 * - password: Admin@123
 * - role: interactive selection
 * - firstName: Admin
 * - lastName: User
 */
async function addNewAdmin() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Set defaults or use provided values for non-interactive args
    const email = args[0] || "admin@anasity.com";
    const password = args[1] || "Admin@123";
    const firstName = args[3] || "Admin";
    const lastName = args[4] || "User";

    // Validate email format
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
      console.error(`Error: Invalid email format: ${email}`);
      process.exit(1);
    }

    // Validate password strength
    if (password.length < 8) {
      console.error("Error: Password must be at least 8 characters long");
      process.exit(1);
    }

    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB successfully!");

    // Validate role interactively
    const role = await validateRole(args[2]);
    console.log(`Selected role: ${role}`);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`\nA user with email ${email} already exists.`);
      console.log(`Current role: ${existingUser.role}`);

      const updateConfirm = await question(
        `\nDo you want to update this user's role to ${role}? (y/n): `
      );

      if (
        updateConfirm.toLowerCase() === "y" ||
        updateConfirm.toLowerCase() === "yes"
      ) {
        // Update the user
        existingUser.role = role;
        await existingUser.save();
        console.log(`\nUser ${email} has been updated to ${role} role.`);
      } else {
        console.log("\nOperation cancelled. User not updated.");
      }
    } else {
      // Ask for confirmation
      const createConfirm = await question(
        `\nCreate a new ${role} with email ${email}? (y/n): `
      );

      if (
        createConfirm.toLowerCase() === "y" ||
        createConfirm.toLowerCase() === "yes"
      ) {
        // Create the new user
        const newAdmin = await User.create({
          firstName,
          lastName,
          email,
          password, // Will be hashed by the model pre-save hook
          role,
          isVerified: true,
          isActive: true,
        });

        console.log(`\nNew ${role} created successfully!`);
        console.log(`Email: ${email}`);
        console.log(`Name: ${firstName} ${lastName}`);
        console.log(`Password: ${password} (please change after first login)`);
      } else {
        console.log("\nOperation cancelled. User not created.");
      }
    }
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    // Close readline interface
    rl.close();

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the script
addNewAdmin().catch((error) => {
  console.error("Fatal error:", error);
  if (rl) rl.close();
  process.exit(1);
});
