const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST, 
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  socketPath: `/cloudsql/capstone-441604:us-central1:geo-mysql`,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(() => {
    console.log('Database connection successful');
  })
  .catch(err => {
    console.error('Error connecting to database:', err);
  });

module.exports = pool;
