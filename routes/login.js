const express = require('express');
const router = express.Router();
const {verifyTokenCookie} = require("../controllers/middlewareAuth.js");
const { register, login, logout, profile } = require("../controllers/login.js");

router.use(verifyTokenCookie);
router.post("/login", login);
router.post("/register", register);
router.post("/logout", logout);
router.put("/profile", profile);

module.exports = router;