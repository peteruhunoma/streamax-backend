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
const cloudinary = require('./cloudinary.js');

require('dotenv').config();

const port = process.env.PORT || 3000;


const app = express();

                                                  
app.use(cors({
  origin:  'https://streamax-rho.vercel.app',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json()); 



app.get('/favicon.ico', (req, res)=>{
  res.status(204).end();
})


// Helper function to upload to Cloudinary with retries
const uploadToCloudinary = (filePath, options, retries = 3) => {
  return new Promise((resolve, reject) => {
    const attemptUpload = (attempt) => {
      cloudinary.uploader.upload(filePath, options, (error, result) => {
        if (error) {
          if (attempt < retries) {
            console.log(`Upload attempt ${attempt} failed, retrying...`);
            attemptUpload(attempt + 1);
          } else {
            reject(error);
          }
        } else {
          resolve(result);
        }
      });
    };
    attemptUpload(1);
  });
};

// Video upload route
app.post('/upload', verifyTokenCookie, async (req, res) => {
  try {
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    // Get user info
    const userId = req.user.id || req.user.userId;
    const username = req.user.res.fullname;
    
    if (!userId || !username) {
      return res.status(400).json({ 
        error: "User information incomplete", 
        userData: req.user 
      });
    }
    
    // Parse form data
    const form = new multiparty.Form({ 
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
        if (uploadedVideo && uploadedVideo.path && fs.existsSync(uploadedVideo.path)) {
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
      
      try {
        // Upload to Cloudinary
        const result = await uploadToCloudinary(uploadedVideo.path, {
          resource_type: "video",
          folder: `streamax/users/${username}/${productName}`,
          public_id: `video_${Date.now()}`,
          overwrite: true,
          use_filename: true,
          unique_filename: false
        });
        
        // Clean up temporary file
        if (fs.existsSync(uploadedVideo.path)) {
          fs.unlinkSync(uploadedVideo.path);
        }
        
        res.status(200).json({ 
          success: true,
          filename: result.public_id,
          url: result.secure_url,
          message: "Video uploaded successfully to Cloudinary"
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        if (fs.existsSync(uploadedVideo.path)) {
          fs.unlinkSync(uploadedVideo.path);
        }
        return res.status(500).json({ error: "Failed to upload to Cloudinary", details: cloudinaryError.message });
      }
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
    
    const form = new multiparty.Form({ 
      maxFilesSize: 50 * 1024 * 1024 // 50MB
    });
    
    form.parse(req, async (parseErr, fields, files) => {
      if (parseErr) {
        return res.status(500).json({ error: 'Upload error', details: parseErr.message });
      }
      
      const productName = fields.productName ? fields.productName[0] : null;
      const uploadedImage = files.image ? files.image[0] : null;
      
      if (!productName) {
        if (uploadedImage && uploadedImage.path && fs.existsSync(uploadedImage.path)) {
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
      
      try {
        // Upload to Cloudinary
        const result = await uploadToCloudinary(uploadedImage.path, {
          resource_type: "image",
          folder: `streamax/users/${username}/${productName}`,
          public_id: `image_${Date.now()}`,
          overwrite: true,
          use_filename: true,
          unique_filename: false,
          transformation: [
            { quality: "auto" },
            { fetch_format: "auto" }
          ]
        });
        
        // Clean up temporary file
        if (fs.existsSync(uploadedImage.path)) {
          fs.unlinkSync(uploadedImage.path);
        }
        
        res.status(200).json({ 
          success: true,
          filename: result.public_id,
          url: result.secure_url,
          message: "Image uploaded successfully to Cloudinary"
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        if (fs.existsSync(uploadedImage.path)) {
          fs.unlinkSync(uploadedImage.path);
        }
        return res.status(500).json({ error: "Failed to upload to Cloudinary", details: cloudinaryError.message });
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: "Server error during image upload" });
  }
});

// Profile image upload route
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
    
    const form = new multiparty.Form({ 
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
      
      try {
        // Upload profile image to Cloudinary
        const result = await uploadToCloudinary(uploadedImage.path, {
          resource_type: "image",
          folder: `streamax/profiles/${username}`,
          public_id: `profile_${Date.now()}`,
          overwrite: true,
          use_filename: true,
          unique_filename: false,
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto" },
            { fetch_format: "auto" }
          ]
        });
        
        // Clean up temporary file
        if (fs.existsSync(uploadedImage.path)) {
          fs.unlinkSync(uploadedImage.path);
        }
        
        // Return only the filename and URL
        res.status(200).json({ 
          success: true,
          filename: result.public_id,
          url: result.secure_url,
          message: "Profile image uploaded successfully to Cloudinary"
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        if (fs.existsSync(uploadedImage.path)) {
          fs.unlinkSync(uploadedImage.path);
        }
        return res.status(500).json({ error: "Failed to upload to Cloudinary", details: cloudinaryError.message });
      }
    });
  } catch (err) {
    console.log('Image upload error:', err);
    res.status(500).json({ error: "Server error during image upload" });
  }
});

// Optional: Route to delete files from Cloudinary
app.delete('/delete-file', verifyTokenCookie, async (req, res) => {
  try {
    const { publicId, resourceType = 'image' } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ error: "Public ID is required" });
    }
    
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    res.status(200).json({ 
      success: true, 
      message: "File deleted successfully",
      result 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: "Failed to delete file" });
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