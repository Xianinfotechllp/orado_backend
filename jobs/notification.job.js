// jobs/sendPushNotification.js
const firebase = require("../config/firebaseAdmin");

module.exports = (agenda) => {
  agenda.define("send", async (job) => {

    const { message } = job.attrs.data;
    try {
      await firebase.messaging().sendEachForMulticast(message);
      console.log("Scheduled notification sent.");
    } catch (err) {
      console.error("Error sending scheduled notification:", err);
    }
  });


agenda.define("send_test", async (job) => {
  const { message } = job.attrs.data;
  console.log("🔁 send_test job triggered at", new Date());

  try {
    await firebase.messaging().sendEachForMulticast(message);
    console.log("✅ send_test message sent");
  } catch (err) {
    console.error("❌ send_test error:", err);
  }
});




};
