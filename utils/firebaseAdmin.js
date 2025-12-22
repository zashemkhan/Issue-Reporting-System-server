const admin = require("firebase-admin");
const serviceAccount = require("./public-infastructure-system-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
