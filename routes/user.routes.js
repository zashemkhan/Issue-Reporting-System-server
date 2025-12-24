const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router();

/**
 * Upgrade user subscription
 */
router.patch("/subscribe/:email", verifyToken, async (req, res) => {
  try {
    const email = req.params.email;

    // Only allow the user to subscribe their own account
    if (req.user.email !== email) {
      return res.status(403).send({ message: "Forbidden" });
    }

    await req.db.users.updateOne(
      { email },
      { $set: { isSubscribed: true, subscribedAt: new Date() } }
    );

    res.send({ message: "Subscription successful" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to upgrade subscription" });
  }
});

module.exports = router;
