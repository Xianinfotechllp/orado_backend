const db = require("../config/dbConfig");
const agenda = require("../config/agenda")

require("../jobs/notification.job")(agenda); 
require("../jobs/checkAgentResponseTimeout")(agenda);
(async () => {
    await db(); 
  await agenda.start(); // ✅ THIS IS REQUIRED
  console.log("✅ Agenda processing started");
})();
