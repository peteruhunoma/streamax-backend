const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require('../db.js');
const {verifyTokenCookie} = require("../controllers/middlewareAuth.js");
const { getUserImage, searchVideos, likedVideo, channeldetails, deletelikedVideo, deleteVideo, privateVideo, contentVideo, getcomment, personalContentVideo, postCommentLikes, getCommentLikes, postComment, addlikes, getlikes,  getsubs, addsubs,   getPost,  getPosts,  addPost, getShortPosts, addShortPost, addviews, viewSubs} = require('../controllers/posts.js');


router.use(verifyTokenCookie);
router.get("/", getPosts);
router.get("/short", getShortPosts);
router.post("/short", addShortPost);
router.post("/subs", addsubs);
router.put("/views", addviews);
router.get("/viewsubs", viewSubs);
router.get("/likedvideo", likedVideo);
router.get("/details/:userid", channeldetails);
router.delete("/deletelike/:videoid", deletelikedVideo);
router.post("/likes", addlikes);
router.get("/profilevideo", contentVideo);
router.get('/search', searchVideos);
router.put("/visibility", privateVideo);
router.get("/personalprofile", personalContentVideo);
router.delete("/deletevideo/:videoid", deleteVideo);
router.post("/commentlikes", postCommentLikes);
router.get("/commentlikes/:id/:commentid", getCommentLikes);
router.post("/comment", postComment);
router.get("/comment/:id", getcomment);
router.get("/likes/:id", getlikes);
router.get("/subs/:userid", getsubs);
router.get("/userimage/:userid", getUserImage);
router.get("/watch/:id", getPost);
router.post("/", addPost);








 

 


module.exports = router;