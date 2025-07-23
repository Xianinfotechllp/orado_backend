var admin = require("firebase-admin");


var serviceAccount = require('./oradosaleapp-firebase-adminsdk-fbsvc-68b0dcdc98.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
module.exports = admin;