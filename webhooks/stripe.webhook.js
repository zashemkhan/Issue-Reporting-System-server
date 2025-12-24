const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { ObjectId } = require("mongodb");

const router = express.Router();

module.exports = (db) => {
  router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // BOOST Payment
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const { type, issueId, email } = intent.metadata;

      if (type === "boost") {
        await db.issues.updateOne({ _id: new ObjectId(issueId) }, { $set: { priority: "high", boostedAt: new Date() } });
        await db.payments.insertOne({ email, issueId: new ObjectId(issueId), amount: 100, type: "boost", transactionId: intent.id, createdAt: new Date() });
        await db.timeline.insertOne({ issueId: new ObjectId(issueId), status: "boosted", message: "Issue priority boosted via Stripe", updatedBy: email, role: "citizen", createdAt: new Date() });
      }

      if (type === "subscription") {
        await db.users.updateOne({ email }, { $set: { isSubscribed: true, subscribedAt: new Date() } });
        await db.payments.insertOne({ email, amount: 1000, type: "subscription", transactionId: intent.id, createdAt: new Date() });
      }
    }

    res.json({ received: true });
  });

  return router;
};
