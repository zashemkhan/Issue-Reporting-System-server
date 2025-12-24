const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { ObjectId } = require("mongodb");

const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();

// Boost Payment Intent
router.post("/boost-intent", verifyToken, async (req, res) => {
  try {
    const { issueId } = req.body;
    if (!issueId) return res.status(400).send({ message: "Issue ID required" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 100 * 100, // 100৳
      currency: "bdt",
      metadata: { type: "boost", issueId, email: req.user.email },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Confirm Boost Payment
router.post("/boost-confirm", verifyToken, async (req, res) => {
  try {
    const { issueId, transactionId } = req.body;
    if (!issueId || !transactionId)
      return res.status(400).send({ message: "Missing data" });

    await req.db.issues.updateOne(
      { _id: new ObjectId(issueId) },
      { $set: { priority: "high", boostedAt: new Date() } }
    );

    await req.db.payments.insertOne({
      email: req.user.email,
      issueId: new ObjectId(issueId),
      amount: 100,
      type: "boost",
      transactionId,
      createdAt: new Date(),
    });

    await req.db.timeline.insertOne({
      issueId: new ObjectId(issueId),
      status: "boosted",
      message: "Issue priority boosted",
      updatedBy: req.user.email,
      role: "citizen",
      createdAt: new Date(),
    });

    res.send({ message: "Issue boosted successfully" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Subscription Payment Intent
router.post("/subscribe-intent", verifyToken, async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000 * 100, // 1000৳
      currency: "bdt",
      metadata: { type: "subscription", email: req.user.email },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Confirm Subscription Payment
router.post("/subscribe-confirm", verifyToken, async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId)
      return res.status(400).send({ message: "Transaction ID required" });

    await req.db.users.updateOne(
      { email: req.user.email },
      { $set: { isSubscribed: true, subscribedAt: new Date() } }
    );

    await req.db.payments.insertOne({
      email: req.user.email,
      amount: 1000,
      type: "subscription",
      transactionId,
      createdAt: new Date(),
    });

    res.send({ message: "Premium subscription activated" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get My Payments
router.get("/my", verifyToken, async (req, res) => {
  try {
    const payments = await req.db.payments
      .find({ email: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(payments);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Admin: View All Payments
router.get("/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payments = await req.db.payments
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(payments);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;
