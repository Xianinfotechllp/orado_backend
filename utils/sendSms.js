const twilio = require("twilio");
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.sendSms = async (to, message) => {
  try {
    const formattedTo = to.startsWith("+") ? to : `+91${to}`;
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedTo,
    });
  } catch (error) {
    console.error("Error sending SMS:", error.message);
  }
};
