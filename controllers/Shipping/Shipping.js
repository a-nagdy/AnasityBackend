// Shipping options data (this would typically come from a database or external API)
const shippingOptions = [
  {
    id: "standard",
    name: "Standard Shipping",
    description: "Delivery within 5-7 business days",
    price: 5.99,
    daysToDeliver: "5-7",
  },
  {
    id: "express",
    name: "Express Shipping",
    description: "Delivery within 2-3 business days",
    price: 12.99,
    daysToDeliver: "2-3",
  },
  {
    id: "overnight",
    name: "Overnight Shipping",
    description: "Delivery by next business day",
    price: 24.99,
    daysToDeliver: "1",
  },
  {
    id: "free",
    name: "Free Shipping",
    description: "Free shipping on orders over $75 (7-10 business days)",
    price: 0,
    daysToDeliver: "7-10",
    minimumOrderAmount: 75,
  },
];

// Get all shipping options
const getShippingOptions = async (req, res) => {
  try {
    res.status(200).json(shippingOptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Calculate shipping for a given cart
const calculateShipping = async (req, res) => {
  try {
    const { cartTotal, items, shippingMethod, country, zipCode } = req.body;

    if (!cartTotal) {
      return res.status(400).json({
        message: "Cart total is required",
        field: "cartTotal",
      });
    }

    if (!shippingMethod) {
      return res.status(400).json({
        message: "Shipping method is required",
        field: "shippingMethod",
      });
    }

    // Get the selected shipping option
    const shippingOption = shippingOptions.find(
      (option) => option.id === shippingMethod
    );

    if (!shippingOption) {
      return res.status(400).json({
        message: "Invalid shipping method",
        field: "shippingMethod",
      });
    }

    // Calculate shipping cost
    let shippingCost = shippingOption.price;

    // Apply free shipping if eligible
    if (
      shippingOption.id === "free" &&
      cartTotal < shippingOption.minimumOrderAmount
    ) {
      // Not eligible for free shipping
      shippingCost = shippingOptions.find(
        (option) => option.id === "standard"
      ).price;
    }

    // Additional logic could be added here for country-specific rates,
    // oversized items, weight calculations, etc.

    // Calculate estimated delivery date
    const today = new Date();
    let minDays = 1;
    let maxDays = 1;

    if (shippingOption.daysToDeliver.includes("-")) {
      [minDays, maxDays] = shippingOption.daysToDeliver
        .split("-")
        .map((d) => parseInt(d));
    } else {
      minDays = maxDays = parseInt(shippingOption.daysToDeliver);
    }

    const estimatedDeliveryDate = new Date(
      today.getTime() + maxDays * 24 * 60 * 60 * 1000
    );

    // Format the response
    const shippingDetails = {
      method: shippingOption.id,
      name: shippingOption.name,
      cost: shippingCost,
      estimatedDeliveryDate: estimatedDeliveryDate.toISOString().split("T")[0],
      estimatedDays: {
        min: minDays,
        max: maxDays,
      },
    };

    res.status(200).json(shippingDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { calculateShipping, getShippingOptions };
