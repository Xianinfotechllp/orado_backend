var admin = require("firebase-admin");


var serviceAccount = require('./orado-1eb0c-firebase-adminsdk-fbsvc-700cb01560.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
module.exports = admin;