const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("./utils/firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const incomingToken = req.headers.authorization;
  if (!incomingToken) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = incomingToken.split(" ")[1];
  try {
    const tokenData = await admin.auth().verifyIdToken(token);
    res.locals.tokenData = tokenData;
    next();
  } catch (err) {
    console.log(err);
    res.status(401).send({ message: "unauthorized access" });
  }
};

app.get("/", (req, res) => {
  res.send("public reporting system!");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ponps9c.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run(callback) {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const db = client.db("PublicIssueReportingSystem");
    const usersCollection = db.collection("users");
    const reportGetCollection = db.collection("ReportGet");
    const assignedIssues = db.collection("assignedIssues");

    // ========== USER ROUTES ==========
    app.post("/user/create", verifyFBToken, async (req, res) => {
      const { email, uid } = res.locals.tokenData;
      const { displayName, photoURL } = req.body;

      const user = await usersCollection.findOne({ email });
      if (user) return res.status(400).send("user already exists");

      const newUserData = {
        uid,
        email,
        role: "user",
        displayName,
        photoURL,
        isSubscribed: false,
        isblock: false,
        createdAT: new Date(),
        updatedAT: new Date(),
      };

      await usersCollection.insertOne(newUserData);
      const createdUser = await usersCollection.findOne({ email });
      res.send(createdUser);
    });

    app.get("/user/user-profile", verifyFBToken, async (req, res) => {
      const { email } = res.locals.tokenData;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.post("/user/social-login", verifyFBToken, async (req, res) => {
      const { email, uid } = res.locals.tokenData;
      const { displayName, photoURL } = req.body;

      const user = await usersCollection.findOne({ email });
      if (user) return res.send(user);

      const newUserData = {
        uid,
        email,
        role: "user",
        displayName,
        photoURL,
        isSubscribed: false,
        isblock: false,
        createdAT: new Date(),
        updatedAT: new Date(),
      };

      await usersCollection.insertOne(newUserData);
      const createdUser = await usersCollection.findOne({ email });
      res.send(createdUser);
    });

    app.post("/user/update-profile", verifyFBToken, async (req, res) => {
      const { email } = res.locals.tokenData;
      const { displayName, photoURL } = req.body;

      const updatedUserData = await usersCollection.findOneAndUpdate(
        { email },
        { $set: { displayName, photoURL } },
        { returnDocument: "after" }
      );
      res.send(updatedUserData);
    });

    app.get("/user/role", async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    // ========== ADMIN ROUTES ==========
    app.get("/admin/manage-users", verifyFBToken, async (req, res) => {
      const manageUsers = await usersCollection
        .find({ role: "user" })
        .toArray();
      res.send(manageUsers);
    });

    app.get("/admin/staff-list", verifyFBToken, async (req, res) => {
      const staffUsers = await usersCollection
        .find({ role: "staff" })
        .toArray();
      res.send(staffUsers);
    });

    app.post("/admin/create-new-staff", verifyFBToken, async (req, res) => {
      const { email, password, name, photoURL, number } = req.body;

      const newFirebaseUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        photoURL,
      });

      const newStaffProfile = {
        uid: newFirebaseUser.uid,
        email,
        displayName: name,
        photoURL,
        number,
        createAt: new Date(),
        updatedAt: new Date(),
        role: "staff",
      };

      const result = await usersCollection.insertOne(newStaffProfile);
      res.send(result);
    });

    app.patch(
      "/admin/update-staff-profile",
      verifyFBToken,
      async (req, res) => {
        const { email, displayName, photoURL, number } = req.body;
        await usersCollection.findOneAndUpdate(
          { email },
          { $set: { displayName, photoURL, number } }
        );
        res.send("staff profile updated");
      }
    );

    app.delete("/admin/staff/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post("/admin/assign-issue", verifyFBToken, async (req, res) => {
      const { issueId, staffEmail } = req.body;
      const assignment = { issueId, staffEmail, assignedAt: new Date() };

      await assignedIssues.insertOne(assignment);
      await reportGetCollection.findOneAndUpdate(
        { _id: new ObjectId(issueId) },
        { $set: { isAssigned: true } }
      );

      res.send({ message: "Issue assigned to staff successfully" });
    });

    // ========== STAFF ROUTES ==========
    app.get("/staff/assigned-issues", verifyFBToken, async (req, res) => {
      try {
        const { email } = res.locals.tokenData;
        const assignments = await assignedIssues
          .find({ staffEmail: email })
          .toArray();

        const issueIds = assignments.map((a) => new ObjectId(a.issueId));
        const issues = await reportGetCollection
          .find({ _id: { $in: issueIds } })
          .toArray();

        const sanitizedIssues = assignments
          .map((a) => {
            const issue = issues.find((i) =>
              i._id.equals(new ObjectId(a.issueId))
            );
            if (!issue) return null;
            return {
              issueId: issue._id,
              title: issue.title,
              status: issue.status,
              assignedAt: a.assignedAt,
            };
          })
          .filter(Boolean);

        res.send(sanitizedIssues);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to load assigned issues" });
      }
    });

    app.patch("/staff/update-issue-status", verifyFBToken, async (req, res) => {
      const { issueId, status } = req.body;
      await reportGetCollection.findOneAndUpdate(
        { _id: new ObjectId(issueId) },
        { $set: { status } }
      );
      res.send("success");
    });

    // ========== ISSUE ROUTES ==========
    app.get("/issues", async (req, res) => {
      try {
        const { skip = 0, category, search } = req.query;
        const limit = parseInt(req.query.limit) || 0;
        const query = {};

        if (category) query.category = category;
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
            { status: { $regex: search, $options: "i" } },
          ];
        }

        const result = await reportGetCollection
          .find(query)
          .limit(limit)
          .sort({ priority: 1 })
          .skip(Number(skip))
          .project({ description: 0 })
          .toArray();

        const count = await reportGetCollection.countDocuments(query);
        res.send({ result, total: count });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/issues/:id", async (req, res) => {
      const issue = await reportGetCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(issue);
    });

    app.post("/issues", verifyFBToken, async (req, res) => {
      const { email } = res.locals.tokenData;
      const report = { ...req.body, email };
      const result = await reportGetCollection.insertOne(report);
      res.send(result);
    });

    // Other routes like patch/delete/upvotes/payment can be added similarly

    callback(null);
  } catch (err) {
    callback(err);
  }
}

run((err) => {
  app.listen(PORT, async () => {
    if (err) console.log("MongoDB connection failed");
    console.log(`server listening on port ${PORT}`);
  });
}).catch(console.dir);
