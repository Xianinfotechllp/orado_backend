const Agent = require('../models/agentModel');
const bcrypt = require('bcrypt');

exports.registerAgent = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      address,
      vehicleDetails,
      bankDetails
    } = req.body;

    // Basic validation
    if (!name || !phone || !email || !password || !address) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Phone number validation
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Password validation
    if (password.length < 6 || !/\d/.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 6 characters and contain a number' });
    }

    // Address validation
    if (address.length < 5) {
      return res.status(400).json({ message: 'Address must be at least 5 characters long' });
    }

    // Vehicle Details validation
    if (!vehicleDetails || !vehicleDetails.type || !vehicleDetails.number) {
      return res.status(400).json({ message: 'Vehicle details are required' });
    }
    const allowedVehicleTypes = ['Bike', 'Car', 'Cycle'];
    if (!allowedVehicleTypes.includes(vehicleDetails.type)) {
      return res.status(400).json({ message: 'Invalid vehicle type' });
    }
    const vehicleNumberRegex = /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/;
    if (!vehicleNumberRegex.test(vehicleDetails.number)) {
      return res.status(400).json({ message: 'Invalid vehicle number format (eg: TS09AB1234)' });
    }

    // Bank Details validation
    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.bankName) {
      return res.status(400).json({ message: 'Bank details are required' });
    }
    if (bankDetails.bankName.length < 3) {
      return res.status(400).json({ message: 'Bank name must be at least 3 characters' });
    }

    // Check if agent already exists
    const existingAgent = await Agent.findOne({ phone });
    if (existingAgent) {
      return res.status(400).json({ message: 'Agent already registered with this phone' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new agent
    const newAgent = new Agent({
      name,
      phone,
      email,
      password: hashedPassword, // store hashed password
      address,
      vehicleDetails,
      bankDetails
    });

    await newAgent.save();

    res.status(201).json({
      message: 'Agent registered successfully',
      agent: {
        _id: newAgent._id,
        name: newAgent.name,
        phone: newAgent.phone,
        email: newAgent.email
      }
    });

  } catch (error) {
    console.error('Agent Registration Error:', error);
    res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
};
