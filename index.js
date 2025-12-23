const express = require("express");
const cors = require("cors");
require("dotenv").config();


const connectDB = require("./config/mongo");
const paymentRoutes = require("./routes/payment.routes");
app.use("/webhook", require("./webhooks/stripe.webhook"));

const app = express();
app.use(cors());
app.use(express.json());
app.use("/payments", paymentRoutes);

(async () => {
  const db = await connectDB();
  app.use((req, res, next) => {
    req.db = db;
    next();
  });

  app.use("/issues", require("./routes/issue.routes"));
  app.use("/admin", require("./routes/admin.routes"));
  app.use("/staff", require("./routes/staff.routes"));

  app.listen(process.env.PORT, () =>
    console.log("Server running on", process.env.PORT)
  );
})();
