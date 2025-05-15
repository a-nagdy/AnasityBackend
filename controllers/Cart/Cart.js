import Cart from "../../models/Cart/Cart.js";
import Product from "../../models/Product/Product.js";

// Get the current user's cart
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id }).populate({
      path: "items.product",
      select: "name price images quantity discountPrice",
    });

    if (!cart) {
      // If no cart exists, create an empty one
      cart = new Cart({
        user: req.user.id,
        items: [],
        totalPrice: 0,
        totalItems: 0,
      });
      await cart.save();
    }

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add item to cart
const addItemToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, color, size } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: "Product ID is required",
        field: "productId",
      });
    }

    // Check if product exists and has enough stock
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        field: "productId",
      });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({
        message: `Not enough stock. Available: ${product.quantity}`,
        field: "quantity",
        available: product.quantity,
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = new Cart({
        user: req.user.id,
        items: [],
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update existing item quantity
      cart.items[existingItemIndex].quantity += quantity;

      // Optional: update color/size if provided
      if (color) cart.items[existingItemIndex].color = color;
      if (size) cart.items[existingItemIndex].size = size;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        color,
        size,
      });
    }

    // Save cart - pre-save hook will calculate totals
    await cart.save();

    // Return populated cart
    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "name price images quantity discountPrice",
    });

    res.status(200).json({
      message: "Item added to cart",
      cart: populatedCart,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const { itemId, quantity, color, size } = req.body;

    if (!itemId) {
      return res.status(400).json({
        message: "Item ID is required",
        field: "itemId",
      });
    }

    if (quantity !== undefined && quantity < 1) {
      return res.status(400).json({
        message: "Quantity must be at least 1",
        field: "quantity",
      });
    }

    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        message: "Item not found in cart",
        field: "itemId",
      });
    }

    // Update item
    if (quantity !== undefined) {
      // Check product stock before updating
      const product = await Product.findById(cart.items[itemIndex].product);

      if (!product) {
        return res.status(404).json({ message: "Product no longer exists" });
      }

      if (product.quantity < quantity) {
        return res.status(400).json({
          message: `Not enough stock. Available: ${product.quantity}`,
          field: "quantity",
          available: product.quantity,
        });
      }

      cart.items[itemIndex].quantity = quantity;
    }

    if (color) cart.items[itemIndex].color = color;
    if (size) cart.items[itemIndex].size = size;

    // Save cart
    await cart.save();

    // Return populated cart
    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "name price images quantity discountPrice",
    });

    res.status(200).json({
      message: "Cart updated",
      cart: populatedCart,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove item from cart
const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Remove item
    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);

    // Save cart
    await cart.save();

    // Return populated cart
    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "name price images quantity discountPrice",
    });

    res.status(200).json({
      message: "Item removed from cart",
      cart: populatedCart,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Clear items
    cart.items = [];
    cart.totalPrice = 0;
    cart.totalItems = 0;

    // Save cart
    await cart.save();

    res.status(200).json({
      message: "Cart cleared",
      cart,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { addItemToCart, clearCart, getCart, removeCartItem, updateCartItem };
