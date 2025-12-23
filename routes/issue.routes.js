const express = require("express");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

/**
 * CREATE ISSUE (Free user max 3)
 */
router.post("/", verifyToken, async (req, res) => {
  const user = await req.db.users.findOne({ email: req.user.email });

  if (!user.isSubscribed) {
    const count = await req.db.issues.countDocuments({ email: user.email });
    if (count >= 3) {
      return res.status(403).send({ message: "Free limit exceeded" });
    }
  }

  const issue = {
    ...req.body,
    email: user.email,
    status: "pending",
    priority: "normal",
    createdAt: new Date(),
  };

  const result = await req.db.issues.insertOne(issue);

  await req.db.timeline.insertOne({
    issueId: result.insertedId,
    status: "pending",
    message: "Issue reported",
    updatedBy: user.email,
    role: "citizen",
    createdAt: new Date(),
  });

  res.send(result);
});

/**
 * GET ALL ISSUES (pagination + filter + search)
 */
router.get("/", async (req, res) => {
  const { page = 1, limit = 10, status, category, priority, search } = req.query;
  const query = {};

  if (status) query.status = status;
  if (category) query.category = category;
  if (priority) query.priority = priority;

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const data = await req.db.issues
    .find(query)
    .sort({ priority: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .toArray();

  const total = await req.db.issues.countDocuments(query);

  res.send({ data, total });
});

/**
 * UPVOTE
 */
router.post("/:id/upvote", verifyToken, async (req, res) => {
  const issueId = req.params.id;
  const email = req.user.email;

  const issue = await req.db.issues.findOne({ _id: new ObjectId(issueId) });
  if (issue.email === email) {
    return res.status(403).send({ message: "Cannot upvote own issue" });
  }

  const exists = await req.db.upvotes.findOne({ issueId, email });
  if (exists) return res.send({ message: "Already upvoted" });

  await req.db.upvotes.insertOne({ issueId, email });
  await req.db.issues.updateOne(
    { _id: new ObjectId(issueId) },
    { $inc: { upvotes: 1 } }
  );

  res.send({ message: "Upvoted" });
});

module.exports = router;
