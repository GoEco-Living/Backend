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

// Endpoint Meals
app.post('/meals', async (req, res) => {
  const { userId, type } = req.body;
  
  try {
    // Cari id tipe meal berdasarkan tipe yang dipilih
    const [mealType] = await pool.query(
      'SELECT id, carbonEmission FROM meal_types WHERE type = ?',
      [type]
    );

    if (mealType.length === 0) {
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    const mealTypeId = mealType[0].id;
    const carbonEmission = mealType[0].carbonEmission;  // Dapatkan emisi karbon dari mealType yang dipilih

    // Menyimpan meal pilihan user ke database
    const [result] = await pool.query(
      'INSERT INTO meals (user_id, meal_type_id, carbonEmission) VALUES (?, ?, ?)',
      [userId, mealTypeId, carbonEmission]
    );

    res.status(201).json({
      message: "Meal added successfully",
      meal: { type, userId, carbonEmission }
    });
  } catch (err) {
    console.error("Error adding meal:", err);
    res.status(500).json({
      message: "Error adding meal",
      error: err.message
    });
  }
});

// Endpoint Transport
app.post('/transport', async (req, res) => {
  const { userId, type, distance } = req.body;

  try {
    // Cari id tipe transportasi berdasarkan tipe yang dipilih
    const [transportType] = await pool.query(
      'SELECT id, carbonEmission FROM transport_types WHERE type = ?',
      [type]
    );

    if (transportType.length === 0) {
      return res.status(400).json({ error: 'Invalid transport type' });
    }

    const transportTypeId = transportType[0].id;
    const carbonEmission = transportType[0].carbonEmission;  // Dapatkan emisi karbon dari transportType yang dipilih

    // Menyimpan transportasi pilihan user ke database
    const [result] = await pool.query(
      'INSERT INTO transport (user_id, transport_type_id, distance, carbonEmission) VALUES (?, ?, ?, ?)',
      [userId, transportTypeId, distance, carbonEmission]
    );

    res.status(201).json({
      message: "Transport added successfully",
      transport: { type, userId, distance, carbonEmission }
    });
  } catch (err) {
    res.status(500).json({ message: "Error adding transport", err });
  }
});

// Endpoint Meal Recommendation
app.get('/user/:userId/meal_recommendation', async (req, res) => {
  const userId = req.params.userId;

  const queryMeals = `
    SELECT mt.type, m.carbonEmission
    FROM meals m
    INNER JOIN meal_types mt ON m.meal_type_id = mt.id
    WHERE m.user_id = ?`;

  try {
    const [mealResults] = await pool.query(queryMeals, [userId]);

    if (mealResults.length === 0) {
      return res.status(404).json({ message: 'No meals found for this user.' });
    }

    // Rekomendasi berdasarkan tipe meal yang dipilih
    let mealRecommendation = '';
    mealResults.forEach(meal => {
      if (meal.type === 'Chicken') {
        mealRecommendation = "Consider switching to a Vegetarian meal to reduce carbon emissions.";
      } else if (meal.type === 'Vegetarian') {
        mealRecommendation = "Vegetarian is healthy, but please consider choosing Vegan meals for a lower carbon footprint.";
      } else if (meal.type === 'Beef') {
        mealRecommendation = "Beef has a high carbon footprint. Consider choosing Chicken or Vegan meals.";
      } else if (meal.type === 'Fish') {
        mealRecommendation = "Consider switching to a Vegetarian meal to reduce carbon emissions.";
      }
    });

    res.json({
      meals: mealResults,
      mealRecommendation
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching meal recommendations", err });
  }
});

// Endpoint Transport Recommendation
app.get('/user/:userId/transport_recommendation', async (req, res) => {
  const userId = req.params.userId;

  const queryTransport = `
    SELECT tt.type, t.distance, t.carbonEmission
    FROM transport t
    INNER JOIN transport_types tt ON t.transport_type_id = tt.id
    WHERE t.user_id = ?`;

  try {
    const [transportResults] = await pool.query(queryTransport, [userId]);

    if (transportResults.length === 0) {
      return res.status(404).json({ message: 'No transport found for this user.' });
    }

    // Rekomendasi berdasarkan tipe transportasi yang dipilih
    let transportRecommendation = '';
    transportResults.forEach(transport => {
      if (transport.type === 'Car') {
        transportRecommendation = "Consider using Public Transportation instead of a Car to lower your carbon footprint.";
      } else if (transport.type === 'Motorcycle') {
        transportRecommendation = "Motorcycles are less eco-friendly. Consider using a Bicycle instead.";
      } else if (transport.type === 'Walk') {
        transportRecommendation = "Walking is really eco-friendly! Consider using a Bicycle if you're tired.";
      } else if (transport.type === 'Bicycle') {
        transportRecommendation = "Bicycle is eco-friendly. Consider walking if you're looking for a healthier option.";
      } else if (transport.type === 'Public Transportation') {
        transportRecommendation = "Public Transportation is less eco-friendly. Consider using a Bicycle or Walk instead.";
      }
    });

    res.json({
      transport: transportResults,
      transportRecommendation
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching transport recommendations", err });
  }
});

// Endpoint Dashboard untuk Menampilkan Meal dan Transportasi Pengguna
app.get('/user/:userId/dashboard', async (req, res) => {
  const userId = req.params.userId;

  // Query meals untuk mengambil data meal
  const queryMeals = `
    SELECT mt.type, m.carbonEmission
    FROM meals m
    INNER JOIN meal_types mt ON m.meal_type_id = mt.id
    WHERE m.user_id = ?`;

  // Query transport untuk mengambil data transportasi
  const queryTransport = `
    SELECT tt.type, t.distance, t.carbonEmission
    FROM transport t
    INNER JOIN transport_types tt ON t.transport_type_id = tt.id
    WHERE t.user_id = ?`;

  try {
    const [mealResults] = await pool.query(queryMeals, [userId]);
    const [transportResults] = await pool.query(queryTransport, [userId]);

    let totalCarbonEmission = 0.0;

    // Hitung total emisi karbon dari meal
    mealResults.forEach(m => {
      const emission = parseFloat(m.carbonEmission);
      if (!isNaN(emission)) {
        totalCarbonEmission += emission;
      }
    });

    // Hitung total emisi karbon dari transport
    transportResults.forEach(t => {
      const emission = parseFloat(t.carbonEmission);
      const distance = parseFloat(t.distance);
      if (!isNaN(emission) && !isNaN(distance)) {
        totalCarbonEmission += emission * distance;
      }
    });

    res.json({
      userId,
      meals: mealResults,
      transport: transportResults,
      totalCarbonEmission: totalCarbonEmission.toFixed(2) // Menampilkan total emisi dengan dua angka desimal
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching user dashboard", err });
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
    
    req.userId = decoded.userId;
    next();
  });
};

// Gunakan middleware ini di endpoint yang membutuhkan autentikasi
app.get('/user/:userId/dashboard', verifyToken, async (req, res) => {
  const userId = req.userId;

  const queryMeals = `
    SELECT m.type, m.carbonEmission
    FROM meals m
    WHERE m.user_id = ?`;

  const queryTransport = `
    SELECT t.type, t.distance, t.carbonEmission
    FROM transport t
    WHERE t.user_id = ?`;

  try {
    const [mealResults] = await pool.query(queryMeals, [userId]);
    const [transportResults] = await pool.query(queryTransport, [userId]);

    res.json({
      userId,
      meals: mealResults,
      transport: transportResults
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching user dashboard", err });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
