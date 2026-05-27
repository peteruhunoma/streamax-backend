const express = require("express");
const favicon = require("serve-favicon");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require('jsonwebtoken');
const login = require('./routes/login.js');
const posts = require('./routes/posts.js');
const pool = require('./db.js');
const multer = require('multer');
const multiparty = require('multiparty');
const path = require('path');
const busboy = require('busboy');
const fs = require("fs");
const {verifyTokenCookie} = require("./controllers/middlewareAuth.js");

require('dotenv').config();

const port = process.env.PORT || 3000;


const app = express();

                                                  
app.use(cors(
  {origin: 'https://streamax-rho.vercel.app', 
credentials: true}));
app.use(cookieParser());
app.use(express.json()); 



app.get('/favicon.ico', (req, res)=>{
  res.status(204).end();
})

app.post('/upload', verifyTokenCookie, async (req, res) => {
  try {
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    // Log the user object to see its structure
    console.log('Full user object:', JSON.stringify(req.user, null, 2));
    
    // Get user info - adjust based on your token structure
    const userId = req.user.id || req.user.userId;
    const username =  req.user.res.fullname;
    
    console.log('Extracted - User ID:', userId);
    console.log('Extracted - Username:', username);
    
    if (!userId || !username) {
      return res.status(400).json({ 
        error: "User information incomplete", 
        userData: req.user 
      });
    }
    
    // Setup directories - use username or userId
    const uploadDir = path.join(__dirname, '../client/streamax/public/uploads');
    const userDir = path.join(uploadDir, username || String(userId));
    
    // Create directories
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Parse form data
    const form = new multiparty.Form({ 
      uploadDir: userDir,
      maxFilesSize: 500 * 1024 * 1024 // 500MB
    });
    
    form.parse(req, async (parseErr, fields, files) => {
      if (parseErr) {
        console.error('Parse error:', parseErr);
        return res.status(500).json({ error: 'Upload error', details: parseErr.message });
      }
      
      const productName = fields.productName ? fields.productName[0] : null;
      const uploadedVideo = files.video ? files.video[0] : null;
      
      if (!productName) {
        if (uploadedVideo && fs.existsSync(uploadedVideo.path)) {
          fs.unlinkSync(uploadedVideo.path);
        }
        return res.status(400).json({ error: "Product name is required" });
      }
      
      if (!uploadedVideo) {
        return res.status(400).json({ error: "No video file uploaded" });
      }
      
      // Check file size
      const fileSize = fs.statSync(uploadedVideo.path).size;
      if (fileSize > 500 * 1024 * 1024) {
        fs.unlinkSync(uploadedVideo.path);
        return res.status(400).json({ error: "Video file too large. Maximum 500MB" });
      }
      
      // Check file type
      const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
      if (!allowedTypes.includes(uploadedVideo.headers['content-type'])) {
        fs.unlinkSync(uploadedVideo.path);
        return res.status(400).json({ error: 'Only video formats allowed (MP4, MPEG, MOV, AVI, WEBM)' });
      }
      
      // Create product directory
      const productDir = path.join(userDir, productName);
      if (!fs.existsSync(productDir)) {
        fs.mkdirSync(productDir, { recursive: true });
      }
      
      // Move file
      const oldPath = uploadedVideo.path;
      const fileExtension = path.extname(uploadedVideo.originalFilename);
      const newFilename = `video_${Date.now()}${fileExtension}`;
      const newPath = path.join(productDir, newFilename);
      
      fs.renameSync(oldPath, newPath);
      
      res.status(200).json({ 
        success: true,
        filename: newFilename,
        message: "Video uploaded successfully"
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: "Server error during upload" });
  }
});

// Image upload route
app.post('/uploadimg', verifyTokenCookie, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const userId = req.user.id || req.user.userId;
    const username = req.user.res.fullname;
    
    if (!userId || !username) {
      return res.status(400).json({ error: "User information incomplete" });
    }
    
    const uploadDir = path.join(__dirname, '../client/streamax/public/uploads');
    const userDir = path.join(uploadDir, username || String(userId));
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    const form = new multiparty.Form({ 
      uploadDir: userDir,
      maxFilesSize: 50 * 1024 * 1024 // 50MB
    });
    
    form.parse(req, async (parseErr, fields, files) => {
      if (parseErr) {
        return res.status(500).json({ error: 'Upload error', details: parseErr.message });
      }
      
      const productName = fields.productName ? fields.productName[0] : null;
      const uploadedImage = files.image ? files.image[0] : null;
      
      if (!productName) {
        if (uploadedImage && fs.existsSync(uploadedImage.path)) {
          fs.unlinkSync(uploadedImage.path);
        }
        return res.status(400).json({ error: "Product name is required" });
      }
      
      if (!uploadedImage) {
        return res.status(400).json({ error: "No image file uploaded" });
      }
      
      const fileSize = fs.statSync(uploadedImage.path).size;
      if (fileSize > 50 * 1024 * 1024) {
        fs.unlinkSync(uploadedImage.path);
        return res.status(400).json({ error: "Image file too large. Maximum 50MB" });
      }
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(uploadedImage.headers['content-type'])) {
        fs.unlinkSync(uploadedImage.path);
        return res.status(400).json({ error: 'Only image formats allowed (JPEG, PNG, JPG, GIF, WEBP)' });
      }
      
      const productDir = path.join(userDir, productName);
      if (!fs.existsSync(productDir)) {
        fs.mkdirSync(productDir, { recursive: true });
      }
      
      const oldPath = uploadedImage.path;
      const fileExtension = path.extname(uploadedImage.originalFilename);
      const newFilename = `image_${Date.now()}${fileExtension}`;
      const newPath = path.join(productDir, newFilename);
      
      fs.renameSync(oldPath, newPath);
      
      res.status(200).json({ 
        success: true,
        filename: newFilename,
        message: "Image uploaded successfully"
      });
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: "Server error during image upload" });
  }
});
app.post('/uploadprofileimg', verifyTokenCookie, async (req, res) => {
  try {
    const loggedInUser = req.user.res;

    if (!loggedInUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const userId = loggedInUser.id;
    const username = loggedInUser.fullname;
    
    if (!userId) {
      return res.status(400).json({ error: "User information incomplete" });
    }
    
    const uploadDir = path.join(__dirname, '../client/streamax/public/uploadeduser');
    const userDir = path.join(uploadDir, username);
    
    // Ensure directories exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    const form = new multiparty.Form({ 
      uploadDir: userDir,
      maxFilesSize: 5 * 1024 * 1024 // 5MB for profile images
    });
    
    form.parse(req, async (parseErr, fields, files) => {
      if (parseErr) {
        console.error('Parse error:', parseErr);
        return res.status(500).json({ error: 'Upload error', details: parseErr.message });
      }
      
      const uploadedImage = files.profileImage ? files.profileImage[0] : (files.image ? files.image[0] : null);
      
      if (!uploadedImage) {
        return res.status(400).json({ error: "No image file uploaded" });
      }
      
      // Validate file size
      const fileSize = fs.statSync(uploadedImage.path).size;
      if (fileSize > 5 * 1024 * 1024) {
        fs.unlinkSync(uploadedImage.path);
        return res.status(400).json({ error: "Image file too large. Maximum 5MB" });
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(uploadedImage.headers['content-type'])) {
        fs.unlinkSync(uploadedImage.path);
        return res.status(400).json({ error: 'Only image formats allowed (JPEG, PNG, JPG, WEBP)' });
      }
      
      const fileExtension = path.extname(uploadedImage.originalFilename);
      const newFilename = `profile_${Date.now()}${fileExtension}`;
      const newPath = path.join(userDir, newFilename);
      
      fs.renameSync(uploadedImage.path, newPath);
      
      // Return ONLY the filename (not the full path)
      res.status(200).json({ 
        success: true,
        filename: newFilename, // Just the filename
        message: "Profile image uploaded successfully"
      });
    });
  } catch (err) {
    console.log('Image upload error:', err);
    res.status(500).json({ error: "Server error during image upload" });
  }
});


 



 






app.use('/api/auth', login);
app.use('/posts', posts);



pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});



module.exports = app;