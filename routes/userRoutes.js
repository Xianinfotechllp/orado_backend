const express = require('express');
const router = express.Router();
const User = require("../models/userModel")
const bcrypt = require('bcryptjs');
require("dotenv").config();
const jwt = require('jsonwebtoken');
const otpGenerator = require('../utils/otpGenerator');
const bruteForcePrevent = require('../middlewares/bruteforcePrevent')
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
      const otp = otpGenerator(6);
      
      
      const newUser = new User({
        name,
        email,
        phone,
        password: hashedPassword,
        verification: {
            otp:otp,

        }
    
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

router.post("/verify-otp", async(req, res) => {

    try {

        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
          }
    
          const user = await User.findOne({ email });
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }
    
          if (user.verification.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
          }
    
          if (user.verification.otpExpiry < new Date()) {
            return res.status(400).json({ message: "OTP has expired" });
          }
          user.verification.emailVerified = true;
          user.verification.phoneVerified = true;
          user.verification.otp = null;
          user.verification.otpExpiry = null;
          await user.save();
          res.json({ message: "OTP verified successfully", userId: user._id });
        
    } catch (error) {
        console.error("OTP Verification Error:", error);
        res.status(500).json({ message: "Server error" });
        
    }

   

})



router.post("/login",bruteForcePrevent, async(req, res) => {
    try {

        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
          }
  
        const userExist = await User.findOne({ email });
        if(!userExist) {
            return res.status(400).json({ message: "User not found" });
        }
   
        const isMatch = await bcrypt.compare(password, userExist.password);
        if(!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const token = jwt.sign({ userId: userExist._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            message: "Logged in successfully",
            userId:userExist._id,
        } )
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
        
    }
})

module.exports = router;