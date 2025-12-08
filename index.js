const express = require('express')
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion,  } = require('mongodb');
const app = express()
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('public reporting system!')
})


const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@mongodb.0ps5adl.mongodb.net/?appName=MongoDB`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
  const db = client.db('PublicIssueReportingSystem')
  const reportGetCollection = db.collection('ReportGet')

app.get('/issues', async (req, res) => {
  const result = await reportGetCollection.find().toArray()
  res.send(result)
})

app.post('/issues', async (req, res) => {
  const report = req.body;
  const result = await reportGetCollection.insertOne(report)
  res.send(result)
})

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
