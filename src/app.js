const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config(); 
socketPath: `/cloudsql/capstone-441604:us-central1:geo-mysql`


const app = express();
app.use(express.json());
app.use(cors());

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
app.get('/', (req, res) => {
  res.send('Test');
});
// Route untuk memeriksa server
app.get('/status', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Tes koneksi database
pool.query('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed', err));

// Endpoint Registrasi
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try { 
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    res.status(201).json({
      userId: result.insertId,
      name,
      email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Email tidak ditemukan' });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Password salah' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1h' }
    );

    res.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
