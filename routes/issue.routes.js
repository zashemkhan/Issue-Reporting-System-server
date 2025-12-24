const express = require("express");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

/**
 * CREATE ISSUE (Public Report)
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const user = await req.db.users.findOne({ email: req.user.email });

    if (!user.isSubscribed) {
      const count = await req.db.issues.countDocuments({ email: user.email });
      if (count >= 3)
        return res.status(403).send({ message: "Free limit exceeded" });
    }

    const issue = {
      ...req.body,
      email: user.email,
      status: "pending",
      priority: "normal",
      createdAt: new Date(),
      upvotes: 0,
      upvotedBy: [],
      boostPrice: 100,
      isAssigned: false,
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
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

/**
 * GET ALL ISSUES WITH FILTERS
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      priority,
      search,
    } = req.query;
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
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

/**
 * UPVOTE ISSUE
 */
router.patch("/upvotes", verifyToken, async (req, res) => {
  try {
    const { _id } = req.body;
    const userId = req.user.uid;

    const issueCollection = req.db.collection("issues");

    const issue = await issueCollection.findOne({ _id: new ObjectId(_id) });

    if (!issue) {
      return res.status(404).send({ message: "Issue not found" });
    }

    if (issue.upvotedBy.includes(userId)) {
      return res.status(400).send({ message: "Already upvoted" });
    }

    const result = await issueCollection.updateOne(
      { _id: new ObjectId(_id) },
      {
        $push: { upvotedBy: userId },
        $inc: { upvotes: 1 },
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

/**
 * GET MY ISSUES
 */
router.get("/my-issues/:email", verifyToken, async (req, res) => {
  try {
    const email = req.params.email;

    if (req.user.email !== email)
      return res.status(403).send({ message: "Forbidden" });

    const issues = await req.db.issues
      .find({ email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(issues);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;
