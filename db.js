const { Pool } = require("pg");
require('dotenv').config();

const pool = new Pool({
    host: 'localhost',
    database: 'streamax',
    user: 'postgres', 
    password: 'freeze',
    port: 5433,
    
});

module.exports = pool;