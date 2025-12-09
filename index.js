const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db('PublicIssueReportingSystem');

    const usersCollection = db.collection('users');
    const reportGetCollection = db.collection('ReportGet');

    // user routes
    app.post('/user/create', verifyFBToken, async (req, res) => {
      const { email, uid } = res.locals.tokenData;
      const { displayName, photoURL } = req.body;

      const user = await usersCollection.findOne({ email });
      if (user) return res.status().send('user already exists');

      const newUserData = {
        uid,
        email,
        role: 'user',
        displayName,
        photoURL,
        createdAT: new Date(),
        updatedAT: new Date(),
      };

      await usersCollection.insertOne(newUserData);
      const createdUser = await usersCollection.findOne({ email });

      res.send(createdUser);
    });

    app.get('/user/get', verifyFBToken, async (req, res) => {
      const { email } = res.locals.tokenData;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.post('/user/social-login', verifyFBToken, async (req, res) => {
      console.log('request coming');
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
        createdAT: new Date(),
        updatedAT: new Date(),
      };

      await usersCollection.insertOne(newUserData);
      const createdUser = await usersCollection.findOne({ email });

      res.send(createdUser);
    });

    // issue routes
    app.get('/issues', async (req, res) => {
      const result = await reportGetCollection.find().toArray();
      res.send(result);
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

    app.delete('/issues/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reportGetCollection.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
