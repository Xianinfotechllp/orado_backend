const Agenda = require('agenda');
require("dotenv").config();

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI,
    collection: 'agendaJobs',
    options: { 
      useUnifiedTopology: true 
    }
  },
  processEvery: '30 seconds',
  maxConcurrency: 20
});

// Enhanced event listeners
agenda.on('ready', () => {
  console.log('✅ Agenda scheduler ready');
  // Don't start here - let the worker control this
});

agenda.on('start', job => {
  console.log(`🚀 Job ${job.attrs.name} starting (ID: ${job.attrs._id})`);
});

agenda.on('success', job => {
  console.log(`✔️ Job ${job.attrs.name} succeeded`);
});

agenda.on('fail', (err, job) => {
  console.error(`❌ Job ${job.attrs.name} failed:`, err);
});

agenda.on('error', err => {
  console.error('🔥 Agenda system error:', err);
  // Consider process.exit(1) here for critical errors
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  agenda.stop(() => {
    console.log('🛑 Agenda gracefully stopped');
    process.exit(0);
  });
}

module.exports = agenda;