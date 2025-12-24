const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/mongo");

// Routes
const paymentRoutes = require("./routes/payment.routes");
const issueRoutes = require("./routes/issue.routes");
const adminRoutes = require("./routes/admin.routes");
const staffRoutes = require("./routes/staff.routes");
const userRoutes = require("./routes/user.routes");

// Middleware for Stripe webhook
const stripeWebhook = require("./webhooks/stripe.webhook");

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Attach raw parser only for Stripe webhook
app.use("/webhook", express.raw({ type: "application/json" }));

// Connect to DB and attach collections to req.db
(async () => {
  try {
    const db = await connectDB();

    // Attach db to every request
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // Routes (DB attach করার পরে)
    app.use("/users", userRoutes);
    app.use("/issues", issueRoutes);
    app.use("/payments", paymentRoutes);
    app.use("/admin", adminRoutes);
    app.use("/staff", staffRoutes);

    // Stripe webhook route (DB লাগলে pass করা হবে)
    app.use("/webhook", stripeWebhook);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start server:", error);
  }
})();
