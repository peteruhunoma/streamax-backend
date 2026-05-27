const express = require('express');
const pool = require('../db.js');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

 

const register = async (req, res) => {
  
  try {
    const password = req.body.password;
    const date = req.body.date;
    const fullName = req.body.fullName;
    const email = req.body.email;
    
    // Check if email exists
    const existingPhoneResult = await pool.query('SELECT id FROM login WHERE email = $1', [email]);
    const existingPhone = existingPhoneResult.rows;
    
    if (existingPhone.length > 0) {
      return res.status(400).json("phone already exist");  
    }
    
    
    
    // Validation checks
    if (!email  || !password || !fullName) {
      return res.status(400).json("some or all field are empty");
    }
    
    
    
     
    
    if (password.length < 6) {
      return res.status(400).json('password is too short');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(password, salt);
    
    // Insert new user
    const result = await pool.query(
      'INSERT INTO login (email, fullname, password, userimage, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
      [email, fullName, hashpassword, "default.jpg", date]
    );
    const userId = result.rows[0].id;
     
    const signup = result.rows;
    res.status(200).json(signup);
    console.log(result.rows);
    console.log(userId);
    
  } catch (err) {
    res.status(500).json(err, "cannot connect to database");
    console.log(err);
  }
};

const login = async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    // Validation checks
    if (!email && !password) {
      return res.status(400).json("All fields are required");
    }
    
    if (!email) {
      return res.status(400).json("Email or username is required");
    }
    
    if (!password) {
      return res.status(400).json("Password is required");
    }

    // Find user by email or username
    const dataResult = await pool.query(
      "SELECT * FROM login WHERE email = $1",
      [email]
    );
    const data = dataResult.rows;

    if (data.length === 0) {
      return res.status(400).json("Invalid login information");
    }

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, data[0].password);
    
    if (!isPasswordCorrect) {
      return res.status(400).json("Password is wrong");
    }

    const picked = data[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { res: picked, id: picked.id },
      'pwduserkey'
    );
    
    const { password: _, ...userData } = picked;
     

    // Set cookie and send response
    res.cookie("control_cookies", token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    }).status(200).json(userData);

    
    
  } catch (err) {
    res.status(500).json("Unable to connect to the database");
    console.log(err);
  }
};

 
 

 
const logout = async (req, res) => {
  try {
    // Clear the cookie
    res.clearCookie('control_cookies', {
      httpOnly: true,
      secure: true,        
      sameSite: 'None',    
    });
    
    // Send a success response back to the frontend
    res.status(200).json({ 
      message: "Logged out successfully",
      success: true 
    });
    
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ 
      message: "Logout failed", 
      error: error.message,
      success: false 
    });
  }
};

const profile = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { image } = req.body; // This should now be just the filename
    
    if (!loggedInUser) {
      return res.status(401).json({ error: "You are not logged in" });
    }
    
    if (!image) {
      return res.status(400).json({ error: "Filename is required" });
    }
    
    // Store only the filename in the database
    const profileUpdate = await pool.query(
      "UPDATE login SET userimage = $1 WHERE id = $2 RETURNING *", 
      [image, loggedInUser.id] // image is just the filename
    );
    
    console.log(profileUpdate);
    res.status(200).json({ 
      success: true, 
      message: "Profile image updated successfully",
      filename: image 
    });
  } catch(err) {
    console.log(err);
    res.status(500).json({ error: "Server error during profile update" });
  }
};

module.exports = {
  register,
  login,
  logout,
  profile
};
