module.exports = (agenda) => ({
  async scheduleNotification(message, sendAt) {
    const job = await agenda.schedule(sendAt, 'send-push-notification', { message });
    
    return {
      jobId: job.attrs._id,
      scheduledAt: job.attrs.nextRunAt,
      status: 'scheduled'
    };
  },

  async cancelNotification(jobId) {
    await agenda.cancel({ _id: jobId });
  }
});