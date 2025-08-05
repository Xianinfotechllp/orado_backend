const agenda = require("../config/agenda")
require("../jobs/notification.job")(agenda); 
(async () => {
  await agenda.start(); // ✅ THIS IS REQUIRED
  console.log("✅ Agenda processing started");
})();
