const express = require('express');
const router = express.Router();
const User = require("../models/userModel")
const bcrypt = require('bcryptjs');
router.post("/register", async(req, res) => {
try {
    const { name, email, phone, password} = req.body;

    if (!name || !email || !phone || !password ) {
        return res.status(400).json({ message: "All fields are required" });
      }
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }],
      });


      if (existingUser) {
        return res
          .status(400)
          .json({ message: "Email or phone number already registered" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = new User({
        name,
        email,
        phone,
        password: hashedPassword,
    
      })

      await newUser.save();
      res.status(201).json({
        message: "User registered successfully",
        userId: newUser._id,
      });
} catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
}
})

module.exports = router;