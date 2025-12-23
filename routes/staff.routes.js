const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const verifyStaff = require("../middleware/verifyStaff");
const { ObjectId } = require("mongodb");

const router = express.Router();

const flow = {
  pending: ["in-progress"],
  "in-progress": ["working"],
  working: ["resolved"],
  resolved: ["closed"],
};

router.patch("/status", verifyToken, verifyStaff, async (req, res) => {
  const { issueId, status } = req.body;

  const issue = await req.db.issues.findOne({ _id: new ObjectId(issueId) });
  if (!flow[issue.status]?.includes(status)) {
    return res.status(400).send({ message: "Invalid status change" });
  }

  await req.db.issues.updateOne(
    { _id: new ObjectId(issueId) },
    { $set: { status } }
  );

  await req.db.timeline.insertOne({
    issueId: new ObjectId(issueId),
    status,
    message: `Status changed to ${status}`,
    role: "staff",
    createdAt: new Date(),
  });

  res.send({ message: "Status updated" });
});

module.exports = router;
