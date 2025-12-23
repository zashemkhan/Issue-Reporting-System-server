const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URI);

module.exports = async () => {
  await client.connect();
  const db = client.db("PublicIssueReportingSystem");
  return {
    users: db.collection("users"),
    issues: db.collection("issues"),
    timeline: db.collection("timeline"),
    payments: db.collection("payments"),
    upvotes: db.collection("upvotes"),
    assignments: db.collection("assignments"),
  };
};
