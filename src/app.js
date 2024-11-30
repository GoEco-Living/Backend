const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

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
  res.send('Welcome to GoEco-Living!');
});

// Route to check server status
app.get('/status', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Test database connection
pool.query('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed', err));

// Endpoint for Registration
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try { 
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email has been registered' });
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

// Endpoint for Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Email could not be found' });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Wrong password' });
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

// Endpoint untuk Menyimpan Data Makanan (Meals)
app.post('/meals', async (req, res) => {
  const { userId, type, carbonEmission, description } = req.body;
  try {
    // Menyimpan data makanan ke tabel meals
    const [mealResult] = await pool.query(
      'INSERT INTO meals (type, carbonEmission, description) VALUES (?, ?, ?)',
      [type, carbonEmission, description]
    );

    // Menyimpan relasi antara pengguna dan makanan
    await pool.query(
      'INSERT INTO user_meals (user_id, meal_id) VALUES (?, ?)',
      [userId, mealResult.insertId]
    );

    res.status(201).json({ message: "Meal added successfully", meal: mealResult });
  } catch (err) {
    res.status(500).json({ message: "Error adding meal", err });
  }
});

// Endpoint untuk Menyimpan Data Transportasi (Transport)
app.post('/transport', async (req, res) => {
  const { userId, type, carbonEmission, description } = req.body;
  try {
    // Menyimpan data transportasi ke tabel transport
    const [transportResult] = await pool.query(
      'INSERT INTO transport (type, carbonEmission, description) VALUES (?, ?, ?)',
      [type, carbonEmission, description]
    );

    // Menyimpan relasi antara pengguna dan transportasi
    await pool.query(
      'INSERT INTO user_transport (user_id, transport_id) VALUES (?, ?)',
      [userId, transportResult.insertId]
    );

    res.status(201).json({ message: "Transport added successfully", transport: transportResult });
  } catch (err) {
    res.status(500).json({ message: "Error adding transport", err });
  }
});

app.get('/user/:userId/recommendation', async (req, res) => {
  const userId = req.params.userId;

  const queryMeals = `
    SELECT m.type, CAST(m.carbonEmission AS DECIMAL(10,2)) AS carbonEmission, m.description
    FROM meals m
    JOIN user_meals um ON m.id = um.meal_id
    WHERE um.user_id = ?`;

  const queryTransport = `
    SELECT t.type, CAST(t.carbonEmission AS DECIMAL(10,2)) AS carbonEmission, t.description
    FROM transport t 
    JOIN user_transport ut ON t.id = ut.transport_id
    WHERE ut.user_id = ?`;

  try {
    const [mealResults] = await pool.query(queryMeals, [userId]);
    const [transportResults] = await pool.query(queryTransport, [userId]);

    let totalCarbonEmission = 0;

    // Menghitung total emisi karbon dari makanan
    mealResults.forEach(m => {
      const emission = parseFloat(m.carbonEmission);
      if (!isNaN(emission)) {
        totalCarbonEmission += emission;
      }
    });

    // Menghitung total emisi karbon dari transportasi
    transportResults.forEach(t => {
      const emission = parseFloat(t.carbonEmission);
      if (!isNaN(emission)) {
        totalCarbonEmission += emission;
      }
    });

    totalCarbonEmission = totalCarbonEmission.toFixed(2);

    // Menyusun rekomendasi berdasarkan total emisi karbon
    let recommendation = "You are doing great! Consider reducing carbon emissions by using more sustainable choices.";

    if (parseFloat(totalCarbonEmission) < 50.00) {
      recommendation = "Great job! Keep up the good work with your eco-friendly choices!";
    } else if (parseFloat(totalCarbonEmission) >= 50.00 && parseFloat(totalCarbonEmission) <= 100.00) {
      recommendation = "You're doing well, but you can reduce your carbon footprint by opting for more sustainable meals and transport.";
    } else if (parseFloat(totalCarbonEmission) > 100.00) {
      recommendation = "Your carbon footprint is quite high. Consider switching to more eco-friendly meals and transportation options.";
    }

    res.json({
      meals: mealResults,
      transport: transportResults,
      totalCarbonEmission,
      recommendation
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching recommendations", err });
  }
});


app.get('/user/:userId/dashboard', async (req, res) => {
  const userId = req.params.userId;

  const queryMeals = `
    SELECT m.type, m.carbonEmission, m.description
    FROM meals m
    JOIN user_meals um ON m.id = um.meal_id
    WHERE um.user_id = ?`;

  const queryTransport = `
    SELECT t.type, t.carbonEmission, t.description
    FROM transport t
    JOIN user_transport ut ON t.id = ut.transport_id
    WHERE ut.user_id = ?`;

  try {
    // Fetch meals dan transport history untuk user tertentu
    const [mealResults] = await pool.query(queryMeals, [userId]);
    const [transportResults] = await pool.query(queryTransport, [userId]);

    // Mengembalikan hasil meals dan transport sebagai bagian dari dashboard pengguna
    res.json({
      userId,
      meals: mealResults,        // Semua makanan yang dipilih oleh pengguna
      transport: transportResults, // Semua transportasi yang dipilih oleh pengguna
    });
  } catch (err) {
    // Menangani error
    res.status(500).json({ message: "Error fetching user dashboard history", err });
  }
});


// Middleware untuk memverifikasi token JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ error: 'Token is required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.userId = decoded.userId;  // Set userId dalam request untuk digunakan di endpoint lain
    next();
  });
};

// Gunakan middleware ini di endpoint yang membutuhkan autentikasi
app.get('/user/:userId/dashboard', verifyToken, async (req, res) => {
  const userId = req.userId;  // Ambil userId dari token yang telah diverifikasi

  // Query untuk mengambil data meals dan transport seperti sebelumnya
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

