import mongoose from "mongoose";
import Address from "../../models/Address/Address.js";

// Get all addresses for the authenticated user
export const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id });

    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single address by ID
export const getAddressById = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.status(200).json(address);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new address
export const createAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phone,
      isDefault = false,
      type = "both",
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode ||
      !country ||
      !phone
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    // If setting as default, update any existing default addresses of the same type
    if (isDefault) {
      // Determine which types to update
      const typesToUpdate = [];
      if (type === "both" || type === "shipping") {
        typesToUpdate.push("shipping", "both");
      }
      if (type === "both" || type === "billing") {
        typesToUpdate.push("billing", "both");
      }

      await Address.updateMany(
        {
          user: req.user.id,
          type: { $in: typesToUpdate },
          isDefault: true,
        },
        { isDefault: false },
        { session }
      );
    }

    // Create the new address
    const address = await Address.create(
      [
        {
          user: req.user.id,
          name,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country,
          phone,
          isDefault,
          type,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Address created successfully",
      address: address[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: error.message });
  }
};

// Update an address
export const updateAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phone,
      isDefault,
      type,
    } = req.body;

    // Find the address to update
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!address) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Address not found" });
    }

    // If setting as default and it wasn't default before or type changed
    if (isDefault && (!address.isDefault || type !== address.type)) {
      // Determine which types to update
      const typesToUpdate = [];
      if (type === "both" || type === "shipping") {
        typesToUpdate.push("shipping", "both");
      }
      if (type === "both" || type === "billing") {
        typesToUpdate.push("billing", "both");
      }

      await Address.updateMany(
        {
          user: req.user.id,
          _id: { $ne: address._id },
          type: { $in: typesToUpdate },
          isDefault: true,
        },
        { isDefault: false },
        { session }
      );
    }

    // Update the address fields
    if (name) address.name = name;
    if (addressLine1) address.addressLine1 = addressLine1;
    address.addressLine2 = addressLine2; // Can be null/undefined
    if (city) address.city = city;
    if (state) address.state = state;
    if (postalCode) address.postalCode = postalCode;
    if (country) address.country = country;
    if (phone) address.phone = phone;
    if (isDefault !== undefined) address.isDefault = isDefault;
    if (type) address.type = type;

    // Save the updated address
    await address.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Address updated successfully",
      address,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: error.message });
  }
};

// Delete an address
export const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Set address as default
export const setDefaultAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { type = "both" } = req.body;

    // Find the address to set as default
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!address) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Address not found" });
    }

    // Determine which types to update
    const typesToUpdate = [];
    if (type === "both" || type === "shipping") {
      typesToUpdate.push("shipping", "both");
    }
    if (type === "both" || type === "billing") {
      typesToUpdate.push("billing", "both");
    }

    // Update any existing default addresses
    await Address.updateMany(
      {
        user: req.user.id,
        _id: { $ne: address._id },
        type: { $in: typesToUpdate },
        isDefault: true,
      },
      { isDefault: false },
      { session }
    );

    // Set the new default address
    address.isDefault = true;
    if (type !== address.type) {
      address.type = type;
    }

    await address.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Address set as default successfully",
      address,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: error.message });
  }
};
