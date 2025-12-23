// utils/firebaseAdmin.js
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
