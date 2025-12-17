const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE);
const admin = require('./utils/firebaseAdmin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const incomingToken = req.headers.authorization;

  if (!incomingToken) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = incomingToken.split(' ')[1];

  try {
    const tokenData = await admin.auth().verifyIdToken(token);
    res.locals.tokenData = tokenData;
    next();
  } catch (err) {
    console.log(err);
    res.status(401).send({ message: 'unauthorized access' });
  }
};

app.get('/', (req, res) => {
  res.send('public reporting system!');
});

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@mongodb.0ps5adl.mongodb.net/?appName=MongoDB`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run(callback) {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');

    const db = client.db('PublicIssueReportingSystem');

    const usersCollection = db.collection('users');
    const reportGetCollection = db.collection('ReportGet');
    const assignedIssues = db.collection('assignedIssues');

    // user routes
    app.post('/user/create', verifyFBToken, async (req, res) => {
      const { email, uid } = res.locals.tokenData;
      const { displayName, photoURL } = req.body;

      const user = await usersCollection.findOne({ email });
      if (user) return res.status(400).send('user already exists');

      const newUserData = {
        uid,
        email,
        role: 'user',
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

    app.get('/user/user-profile', verifyFBToken, async (req, res) => {
      const { email } = res.locals.tokenData;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.post('/user/social-login', verifyFBToken, async (req, res) => {
      // console.log('request coming');
      const { email, uid } = res.locals.tokenData;
      const { displayName, photoURL } = req.body;

      const user = await usersCollection.findOne({ email });
      if (user) return res.send(user);

      const newUserData = {
        uid,
        email,
        role: 'user',
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

    app.post('/user/update-profile', verifyFBToken, async (req, res) => {
      const { email } = res.locals.tokenData;
      const { displayName, photoURL } = req.body;

      const updatedUserData = await usersCollection.findOneAndUpdate(
        { email },
        {
          $set: {
            displayName,
            photoURL,
          },
        },
        {
          returnDocument: 'after',
        }
      );
      res.send(updatedUserData);
    });

    app.get('/user/role', async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //Manage users
    app.get('/admin/manage-users', verifyFBToken, async (req, res) => {
      const manageUsers = await usersCollection.find({ role: 'user' }).toArray();
      res.send(manageUsers);
    });

    // Staff routes
    app.get('/admin/staff-list', verifyFBToken, async (req, res) => {
      const staffUsers = await usersCollection.find({ role: 'staff' }).toArray();

      res.send(staffUsers);
    });

    app.post('/admin/create-new-staff', verifyFBToken, async (req, res) => {
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
        role: 'staff',
      };
      const result = await usersCollection.insertOne(newStaffProfile);

      res.send(result);
    });

    app.patch('/admin/update-staff-profile', verifyFBToken, async (req, res) => {
      const { email, displayName, photoURL, number } = req.body;

      await usersCollection.findOneAndUpdate(
        { email },
        {
          $set: {
            displayName,
            photoURL,
            number,
          },
        }
      );

      res.send('staff profile updated');
    });

    app.delete('/admin/staff/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    app.post('/admin/assign-issue', verifyFBToken, async (req, res) => {
      const { issueId, staffEmail } = req.body;
      const assignment = {
        issueId,
        staffEmail,
        assignedAt: new Date(),
      };
      assignedIssues.insertOne(assignment);
      res.send({ message: 'Issue assigned to staff successfully' });
    });




    app.get('/staff/assigned-issues', verifyFBToken, async (req, res) => {
      try {
        const { email } = res.locals.tokenData;

        const assignments = await assignedIssues.find({ staffEmail: email }).toArray();

        const issueIds = assignments.map((a) => new ObjectId(a.issueId));

        const issues = await reportGetCollection.find({ _id: { $in: issueIds } }).toArray();

        const sanitizedIssues = assignments
          .map((assignment) => {
            const issue = issues.find((i) => i._id.equals(new ObjectId(assignment.issueId)));

            if (!issue) return null;

            return {
              issueId: issue._id,
              title: issue.title,
              status: issue.status,
            };
          })
          .filter(Boolean); // remove nulls

        res.send(sanitizedIssues);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Failed to load assigned issues' });
      }
    });

    app.patch('/staff/update-issue-status', verifyFBToken, async (req, res) => {
      const { issueId, status } = req.body;

      const query = { _id: new ObjectId(issueId) };
      await reportGetCollection.findOneAndUpdate(query, {
        $set: {
          status,
        },
      });
      res.send('success');
    });

    // issue routes
    app.get('/issues', async (req, res) => {
      try {
        const { skip = 0, category, search } = req.query;
        const limit = parseInt(req.query.limit);
        const query = {};

        // Category filter
        if (category) {
          query.category = category;
        }

        // Search filter
        if (search) {
          query.$or = [{ title: { $regex: search, $options: 'i' } }, { location: { $regex: search, $options: 'i' } }, { status: { $regex: search, $options: 'i' } }];
        }

        const result = await reportGetCollection.find(query).limit(limit).sort({ priority: 1 }).skip(Number(skip)).project({ description: 0 }).toArray();

        const count = await reportGetCollection.countDocuments(query);

        res.send({ result, total: count });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.get('/issues/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reportGetCollection.findOne(query);
      res.send(result);
    });

    app.get('/my-issues/:email', verifyFBToken, async (req, res) => {
      const userEmail = req.params.email;

      const result = await reportGetCollection.find({ email: userEmail }).toArray();
      res.send(result);
    });

    app.delete('/issues/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reportGetCollection.deleteOne(query);
      res.send(result);
    });
    app.patch('/issues/update-issue-status', async (req, res) => {
      const { issueId, status } = req.body;
      const query = { _id: new ObjectId(issueId) };
      const result = await reportGetCollection.updateOne(query, { $set: { status } });
      res.send(result);
    });
    // payment
    app.get('/issue/payment/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reportGetCollection.findOne(query);
      res.send(result);
    });

    app.patch('/issue/update-status/:id', async (req, res) => {
      const id = req.params.id;
      const { priority } = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { priority: 'high' } };

      const result = await reportGetCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.post('/issues', verifyFBToken, async (req, res) => {
      const { email } = res.locals.tokenData;
      const report = { ...req.body, email };
      const result = await reportGetCollection.insertOne(report);
      res.send(result);
    });

    app.patch('/issues/:id', async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updateData,
      };
      const result = await reportGetCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // upvotes
    app.patch('/issue/upvotes', verifyFBToken, async (req, res) => {
      const { _id } = req.body;
      const { uid } = res.locals.tokenData;

      const issue = await reportGetCollection.findOne({
        _id: new ObjectId(_id),
      });

      if (issue.createdBy === uid) {
        return res.status(403).send('You cannot upvote your own issue');
      }

      if (!issue) return res.status(404).send('Issue not found');

      if (issue.upvotedBy?.includes(uid)) {
        return res.status(400).send({ message: 'You already upvoted this issue' });
      }

      const updated = await reportGetCollection.findOneAndUpdate(
        { _id: new ObjectId(_id) },
        {
          $inc: { upvotes: 1 },
          $addToSet: { upvotedBy: uid },
        },
        { returnDocument: 'after' }
      );

      res.send(updated);
    });

    app.patch('/users/subscribe/:email', async (req, res) => {
      const email = req.params.email;

      const result = await usersCollection.updateOne(
        { email: email },
        {
          $set: {
            isSubscribed: true,
          },
        }
      );

      res.send(result);
    });

    app.patch('/users/block/:id', async (req, res) => {
      const id = req.params.id;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            isblock: true,
          },
        }
      );

      res.send(result);
    });
    app.patch('/users/unblock/:id', async (req, res) => {
      const id = req.params.id;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            isblock: false,
          },
        }
      );

      res.send(result);
    });

    app.post('/create-checkout-session', async (req, res) => {
      const { email, issueId } = req.body;

      const issue = await reportGetCollection.findOne({
        _id: new ObjectId(issueId),
      });

      const boostPriceBDT = issue.boostPrice;
      const usdRate = 100;
      const priceInUSD = boostPriceBDT / usdRate;

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: Math.round(priceInUSD * 100),
                product_data: {
                  name: 'Issue Boost',
                },
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          customer_email: email,
          metadata: { issueId },
          success_url: `${process.env.DOMAIN}/payment-success?issueId=${issueId}`,
          cancel_url: `${process.env.DOMAIN}/payment-cancel`,
        });

        res.send({ url: session.url });
      } catch (error) {
        res.status(500).send({ error: 'Stripe session failed' });
      }
    });

    callback(null);
  } catch (err) {
    callback(err);
  }
}
run((err) => {
  app.listen(PORT, async () => {
    if (err) {
      console.log('MongoDB connection failed');
    }
    console.log(`server listening on port ${PORT}`);
  });
}).catch(console.dir);
