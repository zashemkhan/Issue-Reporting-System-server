const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const { ObjectId } = require("mongodb");

const router = express.Router();

router.post("/assign", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { issueId, staffEmail } = req.body;

    await req.db.assignments.insertOne({
      issueId,
      staffEmail,
      assignedAt: new Date(),
    });

    await req.db.timeline.insertOne({
      issueId: new ObjectId(issueId),
      status: "pending",
      message: `Assigned to ${staffEmail}`,
      updatedBy: "admin",
      role: "admin",
      createdAt: new Date(),
    });

    res.send({ message: "Assigned" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

router.patch("/reject/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    await req.db.issues.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "rejected" } }
    );

    await req.db.timeline.insertOne({
      issueId: new ObjectId(id),
      status: "rejected",
      message: "Issue rejected by admin",
      role: "admin",
      createdAt: new Date(),
    });

    res.send({ message: "Rejected" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;
