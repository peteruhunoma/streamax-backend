const pool = require('../db.js');
const cookieParser = require('cookie-parser');
const multiparty = require('multiparty');
const path = require('path');
const fs = require("fs");
const jwt = require('jsonwebtoken');
const {verifyTokenCookie} = require("./middlewareAuth.js");
const CryptoJS = require("crypto-js");

require('dotenv').config();


const getPosts = async (req, res) => {
  try {
    const { rows: videos } = await pool.query(`
      SELECT v.*, l.userimage 
      FROM videos v
      LEFT JOIN login l ON l.id = v.user_id
      WHERE v.visibility = $1 AND v.short = $2 
      ORDER BY v.created_at DESC
    `, ["public", false]);
    
    // Convert comma-separated tags to array for each video
    const formattedVideos = videos.map(video => ({
      ...video,
      tags: video.tags ? video.tags.split(',').map(tag => tag.trim()) : []
    }));
    
    res.status(200).json(formattedVideos);
    console.log(formattedVideos[0]?.tags);
    console.log(formattedVideos[0]?.userimage); // Will show the user image
  
  } catch (err) {
    console.log('getPosts error:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
};
const getShortPosts = async (req, res) => {
  try {
    const short = true;
    // Get contacts with their status
    const { rows: videos } = await pool.query(`SELECT * FROM videos WHERE visibility = $1 AND short = $2 ORDER BY created_at DESC`, ["public", short]);
    
    res.status(200).json(videos);
    console.log(videos)
  
  } catch (err) {
    console.log('getChats error:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

const getPost = async (req, res) => {
  try {
    const { id } = req.params;
   
    const watchID = parseInt(id);
    
    const { rows: watchRows } = await pool.query(
      `SELECT * FROM videos 
       WHERE id = $1`, 
      [watchID]
    );
    const {rows : userimage} = await pool.query(`SELECT userimage FROM login WHERE id = $1`, [watchRows[0].user_id])
    // Convert comma-separated tags to array
    const watch = watchRows.map(video => ({
      ...video,
      tags: video.tags ? video.tags.split(',').map(tag => tag.trim()) : []
    }));
    
    console.log('Debug info:', {
      watch,
      tagsArray: watch[0]?.tags // Will show ['music', 'sport', 'celebrity']
    });
    
    return res.status(200).json({ 
      success: true, 
      watch,
      userimage
    });
    
  } catch (err) {
    console.error("Database query error (authenticated):", err);
    return res.status(500).json({ 
      message: "Database error", 
      error: err.message 
    });
  } 
};

const addPost = async (req, res) => {
  try {
    const { title, description, tags, thumbnail, visibility, video } = req.body;
    const loggedInUser = req.user;
    
    if (!loggedInUser || !loggedInUser.id) {
      return res.status(401).json({ error: "You are not logged in" });
    }
    
    // Make sure to use 'thumbnail' and 'video' (not 'thumbnails' or 'videos')
    const result = await pool.query(
      `INSERT INTO videos 
       (title, description, tags, thumbnails, visibility, video, user_id, username, short, created_at)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) 
       RETURNING *`,
      [title, description, tags, thumbnail, visibility, video, loggedInUser.id, loggedInUser.res.fullname, false]
    );
    
    res.status(200).json({
      success: true,
      post: result.rows[0]
    });
    
  } catch (err) {
    console.log("Error in addPost:", err);
    res.status(500).json({ 
      error: "Failed to create post", 
      details: err.message 
    });
  }
};
const addShortPost = async (req, res) => {
  try {
    const short = true;
    const { title, description, tags, thumbnail, visibility, video } = req.body;
    const loggedInUser = req.user;
    
    if (!loggedInUser || !loggedInUser.id) {
      return res.status(401).json({ error: "You are not logged in" });
    }
    
    // Make sure to use 'thumbnail' and 'video' (not 'thumbnails' or 'videos')
    const result = await pool.query(
      `INSERT INTO videos 
       (title, description, tags, thumbnails, visibility, video, user_id, username, short, created_at)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) 
       RETURNING *`,
      [title, description, tags, thumbnail, visibility, video, loggedInUser.id, loggedInUser.res.fullname, short]
    );
    
    res.status(200).json({
      success: true,
      post: result.rows[0]
    });
    
  } catch (err) {
    console.log("Error in addPost:", err);
    res.status(500).json({ 
      error: "Failed to create post", 
      details: err.message 
    });
  }
};

const addsubs = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { userid } = req.body;
    const sub = 1;

    if (!loggedInUser) {
      return res.status(401).json({ error: "You are not logged in" });
    }

    // Check if channel exists
    const { rows: channelname } = await pool.query(
      "SELECT fullname FROM login WHERE id = $1",
      [userid]
    );
    
    if (channelname.length === 0) {
      return res.status(404).json({ error: "Channel not found" });
    }
    
    const channel = channelname[0].fullname;
    console.log(channel);

    // Check if already subscribed
    const { rows: subs } = await pool.query(
      "SELECT id FROM subscribers WHERE subid = $1 AND userid = $2",
      [userid, loggedInUser.id]
    );

    // If already subscribed, unsubscribe
    if (subs.length > 0) {
      await pool.query(
        "DELETE FROM subscribers WHERE id = $1 RETURNING *",
        [subs[0].id]
      );
      return res.status(200).json({ message: "Unsubscribed successfully" });
    }

    // Otherwise, subscribe
    const { rows: result } = await pool.query(
      `INSERT INTO subscribers (subid, userid, channelname, username, subs, created_at) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [userid, loggedInUser.id, channel, loggedInUser.fullname, sub]
    );

    console.log(result);
    return res.status(200).json({ message: "Subscribed successfully", data: result[0] });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

const addlikes = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { id } = req.body;
    const addlike = 1;

    if (!loggedInUser) {
      return res.status(401).json({ error: "You are not logged in" });
    }

    const { rows: video } = await pool.query(
      "SELECT id, title FROM videos WHERE id = $1 ",
      [id]
    );

    
    // Check if already subscribed
    const { rows: like } = await pool.query(
      "SELECT id FROM likes WHERE videoid = $1 AND userid = $2",
      [id, loggedInUser.id]
    );

    // If already subscribed, unsubscribe
    if (like.length > 0) {
      await pool.query(
        "DELETE FROM likes WHERE id = $1",
        [like[0].id]
      );
      return res.status(200).json({ message: "Unlike successfully" });
    }

    // Otherwise, subscribe
    const { rows: result } = await pool.query(
      `INSERT INTO likes (videoid, userid, username,  videoname, videolike, created_at) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [id, loggedInUser.id, loggedInUser.fullname, video[0].title, addlike]
    );

    console.log(result);
    return res.status(200).json({ message: "liked successfully", data: result[0] });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

const getsubs = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { userid } = req.params;
    
    console.log('loggedInUser:', loggedInUser);
    console.log('id param:', userid);
    
    if (!loggedInUser) {
      return res.status(401).json("you are not logged in");
    }

    const { rows: subs } = await pool.query(
      "SELECT subs, userid, subid FROM subscribers WHERE subid = $1", 
      [userid]
    );
    
    console.log('subs result:', subs);
    console.log('subs length:', subs.length);
    
 
    if (subs.length > 0 && subs[0].userid === loggedInUser.id) {
      return res.status(200).json({ message: "subscribed", subs });
    }
    
    return res.status(200).json({subs: subs});
    
  } catch(err) {
    console.error('Full error:', err); // Log the actual error
    return res.status(500).json({ error: err.message }); // Send error message
  }
}
const getlikes = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { id } = req.params;
    
    console.log('loggedInUser:', loggedInUser);
    console.log('id param:', id);
    
    if (!loggedInUser) {
      return res.status(401).json("you are not logged in");
    }

    const { rows: likes } = await pool.query(
      "SELECT videolike, userid, videoid FROM likes WHERE videoid = $1", 
      [id]
    );
    
    console.log('subs result:', likes);
    console.log('subs length:', likes.length);
    
 
    if (likes.length > 0 && likes[0].userid === loggedInUser.id) {
      return res.status(200).json({ message: "liked", likes });
    }
    console.log(likes, "jjjjjjj");
    return res.status(200).json({likes: likes});
    
  } catch(err) {
    console.error('Full error:', err); // Log the actual error
    return res.status(500).json({ error: err.message }); // Send error message
  }
}

const addviews = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { id } = req.body;
    
    if (!loggedInUser) {
      return res.status(401).json("you are not logged in");
    }

    // Get current views first
    const { rows: currentVideo } = await pool.query(
      "SELECT views FROM videos WHERE id = $1",
      [id]
    );

    if (currentVideo.length === 0) {
      return res.status(404).json("Video not found");
    }

    const currentViews = currentVideo[0].views;
    const newViews = currentViews + 1;

    // Update with new view count
    const { rows: updatedVideo } = await pool.query(
      "UPDATE videos SET views = $1 WHERE id = $2 RETURNING *",
      [newViews, id]
    );

    res.status(200).json({ message: "View added successfully", video: updatedVideo[0] });
  } catch (err) {
    res.status(500).json(err);
  }
};
const postComment = async (req, res) => {
  try {
    const { comment, id } = req.body;
    const loggedInUser = req.user?.res;
    
    if (!loggedInUser.id) {
      return res.status(401).json("You are not logged in");
    }
    
    const { rows: video } = await pool.query(
      "SELECT id, title FROM videos WHERE id = $1 ",
      [id]
    );
     
     
    const chatResult = await pool.query(
      `INSERT INTO comment 
       (userid, videoid, comment, username, videoname, created_at) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [loggedInUser.id, id, comment, loggedInUser.fullname, video[0].title]);
    
    
    return res.status(200).json({ 
      message: "success", 
      comments: chatResult.rows[0] 
    });
    
  } catch (err) {
    console.log("Error in message function:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};
const postCommentLikes = async (req, res) => {
  try {
    const { id, commentid} = req.body;
    const loggedInUser = req.user?.res;
    const videolike = 1;
    
    if (!loggedInUser.id) {
      return res.status(401).json("You are not logged in");
    }
    
    const { rows: video } = await pool.query(
      "SELECT id, title FROM videos WHERE id = $1 ",
      [id]
    );
    const { rows: like } = await pool.query(
      "SELECT id FROM commentlikes WHERE videoid = $1 AND userid = $2",
      [id, loggedInUser.id]
    );

    // If already liked, unlike
    if (like.length > 0) {
      await pool.query(
        "DELETE FROM commentlikes WHERE id = $1",
        [like[0].id]
      );
      return res.status(200).json({ message: "Unlike successfully" });
    }

     
    const chatResult = await pool.query(
      `INSERT INTO commentlikes 
       (userid, videoid, commentid, videolike, username, videoname,  created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [loggedInUser.id, id, commentid, videolike, loggedInUser.fullname, video[0].title]);
    
    
    return res.status(200).json({ 
      message: "success", 
      likes: chatResult.rows[0] 
    });
    
  } catch (err) {
    console.log("Error in message function:", err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};
const getcomment = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { id } = req.params;
    
    console.log('loggedInUser:', loggedInUser);
    console.log('id param:', id);
    
    if (!loggedInUser) {
      return res.status(401).json("you are not logged in");
    }

    const { rows: comment } = await pool.query(
      "SELECT * FROM comment WHERE videoid = $1", 
      [id]
    );
  
     return res.status(200).json({comments: comment});
    
  } catch(err) {
    console.error('Full error:', err); // Log the actual error
    return res.status(500).json({ error: err.message }); // Send error message
  }
}
const getCommentLikes = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { id, commentid } = req.params;
    
    console.log('loggedInUser:', loggedInUser);
    console.log('id param:', id);
    
    if (!loggedInUser) {
      return res.status(401).json("you are not logged in");
    }

    const { rows: comment } = await pool.query(
      "SELECT * FROM commentlikes WHERE videoid = $1 AND commentid = $2", 
      [id, commentid]
    );
  
     return res.status(200).json({comments: comment});
    
  } catch(err) {
    console.error('Full error:', err); // Log the actual error
    return res.status(500).json({ error: err.message }); // Send error message
  }
}
const contentVideo = async (req, res) => {
  try{
    const loggedInUser = req.user?.res;
    const userid = req.query.userid;
    if (!loggedInUser.id) {
      return res.status(401).json("you are not logged in");
    }
    
    const { rows: videos } = await pool.query(`
      SELECT v.*, l.userimage 
      FROM videos v
      LEFT JOIN login l ON l.id = v.user_id
      WHERE v.user_id = $1 AND v.visibility = $2 
      ORDER BY v.created_at DESC
    `, [userid, "public"]);
    
    // Format tags if needed (like in your getPosts function)
    const formattedVideos = videos.map(video => ({
      ...video,
      tags: video.tags ? video.tags.split(',').map(tag => tag.trim()) : []
    }));
    
    res.status(200).json(formattedVideos);
    console.log(userid);
    console.log(formattedVideos[0]?.userimage); // Will show the user image
    
  }catch(err){
    console.log(err);
    res.status(500).json(err);
  }
}
const personalContentVideo = async (req, res) => {
  try{
    const loggedInUser = req.user?.res;
    const userid = req.query.userid;
    if (!loggedInUser.id) {
      return res.status(401).json("you are not logged in");
    }
    
    const { rows: videos } = await pool.query(`
      SELECT v.*, l.userimage 
      FROM videos v
      LEFT JOIN login l ON l.id = v.user_id
      WHERE v.user_id = $1 
      ORDER BY v.created_at DESC
    `, [userid]);
    
    // Format tags if needed (like in your getPosts function)
    const formattedVideos = videos.map(video => ({
      ...video,
      tags: video.tags ? video.tags.split(',').map(tag => tag.trim()) : []
    }));
    
    res.status(200).json(formattedVideos);
    console.log(userid);
    console.log(formattedVideos[0]?.userimage); // Will show the user image
    
  }catch(err){
    console.log(err);
    res.status(500).json(err);
  }
}
const deleteVideo = async (req, res) => {
try{
  const loggedInUser = req.user?.res;
  const videoid = req.params.videoid;
  if (!loggedInUser.id) {
    return res.status(401).json("you are not logged in");
  }
  console.log(videoid);
  const { rows: deletedVideos } = await pool.query(
    "DELETE FROM videos WHERE id = $1 RETURNING *", 
    [videoid]
  );
  res.status(200).json(deletedVideos);

}catch(err){
  res.status(500).json(err)
}
}
const privateVideo = async (req, res) => {
try{
  const loggedInUser = req.user?.res;
  const {id, status} = req.body;
  if (!loggedInUser.id) {
    return res.status(401).json("you are not logged in");
  }
  const { rows: vbVideos } = await pool.query(
    "UPDATE videos SET visibility = $1 WHERE id = $2", 
    [status, id]
  );
  res.status(200).json(vbVideos);
    console.log(vbVideos);
    console.log(id);
    console.log(status);
}catch(err){
  res.status(500).json(err);
  console.log(err);
}
}
const viewSubs = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
  
    if (!loggedInUser?.id) {
      return res.status(401).json("you are not logged in");
    }

    // Get all subscribed channels
    const { rows: channels } = await pool.query(
      `SELECT l.* FROM login l
       INNER JOIN subscribers s ON l.id = s.subid
       WHERE s.userid = $1`,
      [loggedInUser.id]
    );

    // Get videos for each channel
    for (let channel of channels) {
      const { rows: videos } = await pool.query(
        "SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC",
        [channel.id]
      );
      channel.videos = videos;
    }
    
    res.status(200).json(channels);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
const likedVideo = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
  
    if (!loggedInUser?.id) {
      return res.status(401).json("you are not logged in");
    }

    // Get videos with their corresponding like IDs in one query
    const { rows: videosWithLikeIds } = await pool.query(
      `SELECT v.*, l.id as like_id
       FROM videos v
       INNER JOIN likes l ON v.id = l.videoid
       WHERE l.userid = $1`,
      [loggedInUser.id]
    );
    
    res.status(200).json(videosWithLikeIds);
  } catch(err) {
    console.log(err);
    res.status(500).json(err);
  }
}
const deletelikedVideo = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { videoid } = req.params;

    if (!loggedInUser?.id) {
      return res.status(401).json("you are not logged in");
    }
 console.log(videoid, "lopuwhh")
    
    
    // If already subscribed, unsubscribe
    
      const {rows : liked} = await pool.query("DELETE FROM likes WHERE id = $1 AND userid = $2",
        [videoid, loggedInUser.id]
      );
    
    res.status(200).json(liked);
  } catch(err) {
    console.log(err);
    res.status(500).json(err);
  }
}
const channeldetails = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const { userid } = req.params;

    if (!loggedInUser?.id) {
      return res.status(401).json("you are not logged in");
    }
 console.log(userid, "lopuwhh")
    
    
    // If already subscribed, unsubscribe
    
      const {rows : details} = await pool.query("SELECT id, fullname FROM login WHERE id = $1",
        [userid]
      );
    
    res.status(200).json(details);
  } catch(err) {
    console.log(err);
    res.status(500).json(err);
  }
}
const searchVideos = async (req, res) => {
  const { q } = req.query;

  try {
    // If no query, return an empty array or recent posts
    if (!q) {
      return res.status(200).json([]);
    }

    const searchQuery = `
      SELECT * FROM videos 
      WHERE 
        title ILIKE $1 OR 
        username ILIKE $1 OR 
        description ILIKE $1
      ORDER BY created_at DESC 
      LIMIT 20;
    `;

    // The '%' around the variable allows partial matching (e.g., 'react' matches 'React Hooks')
    const values = [`%${q}%`];
    const result = await pool.query(searchQuery, values);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
const getUserImage = async (req, res) => {
  try {
    const loggedInUser = req.user?.res;
    const userid = req.params.userid;
    
    if (!loggedInUser?.id) {
      return res.status(401).json({ msg: "You are not logged in" });
    }
    
    const { rows: userimage } = await pool.query(`
      SELECT userimage FROM login 
      WHERE id = $1
    `, [userid]);
    
    
    res.status(200).json({userimage: userimage});
    console.log(`User image fetched for id: ${userid}`);
    
  } catch(err) {
    console.log('getUserImage error:', err);
    res.status(500).json({ msg: "Server error" });
  }
};





















module.exports = {
    getPosts,
    getShortPosts,
    addShortPost,
    getPost,
    addPost,
    getsubs,
    addsubs,
    addviews,
    addlikes,
    getlikes,
    postComment,
    getcomment,
    postCommentLikes,
    getCommentLikes,
    contentVideo,
    personalContentVideo,
    deleteVideo,
    privateVideo,
    viewSubs,
    likedVideo,
    deletelikedVideo,
    channeldetails,
    searchVideos,
    getUserImage
}