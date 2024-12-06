const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const tf = require('@tensorflow/tfjs-node');  // TensorFlow.js untuk penggunaan model

const app = express();
app.use(express.json());
app.use(cors());

// Koneksi database
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  socketPath: '/cloudsql/capstone-441604:us-central1:geo-mysql',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Fungsi untuk memuat model (meal dan transport model)
const loadModels = async () => {
  try {
    const mealsModel = await tf.loadGraphModel('https://storage.googleapis.com/geo-ml/meals/model.json');
    const transportModel = await tf.loadGraphModel('https://storage.googleapis.com/geo-ml/transport/model.json');
    console.log('Models loaded successfully');
    return { mealsModel, transportModel };
  } catch (error) {
    console.error('Error loading models:', error);
    throw new Error('Error loading models');
  }
};

// Fungsi prediksi untuk meals
const predictMeals = async (model, data) => {
    try {
        // Faktor emisi karbon berdasarkan jenis makanan (dalam kg CO2 per 100g)
        const emissionFactors = {
            "chicken": 0.5,      // Emisi untuk ayam
            "beef": 2.5,         // Emisi untuk daging sapi
            "fish": 0.7,         // Emisi untuk ikan
            "vegan": 0.1,        // Emisi untuk makanan vegan
            "vegetarian": 0.2    // Emisi untuk makanan vegetarian
        };

        // Hitung total emisi karbon untuk makanan
        const mealEmissions = data.map(item => {
            // Menghitung emisi berdasarkan jenis makanan
            const emission = emissionFactors[item.food.toLowerCase()] * 1;  // Asumsikan kuantitas makanan adalah 100 gram (1)
            return emission;
        });

        // Total emisi karbon dari semua makanan
        const totalEmission = mealEmissions.reduce((sum, emission) => sum + emission, 0);
        console.log("Total emisi karbon dari makanan:", totalEmission);

        // Mengembalikan total emisi dalam bentuk array
        return [totalEmission];
    } catch (error) {
        console.error("Error saat prediksi meals:", error);
        throw new Error('Prediction failed for meals');
    }
};

// Fungsi prediksi untuk transportasi
const predictTransport = async (model, data) => {
    try {
        // Faktor emisi karbon berdasarkan jenis transportasi (dalam kg CO2 per km)
        const emissionFactors = {
            "car": 0.2,           // Emisi per km untuk mobil
            "bus": 0.05,          // Emisi per km untuk bus
            "walk": 0,            // Tidak ada emisi untuk berjalan kaki
            "bike": 0,            // Tidak ada emisi untuk bersepeda
            "motorcycle": 0.15,   // Emisi per km untuk sepeda motor
            "public transportation": 0.03  // Emisi per km untuk transportasi publik
        };

        // Hitung total emisi karbon untuk transportasi
        const transportEmissions = data.map(item => {
            // Menghitung emisi berdasarkan jenis transportasi dan jarak
            const emission = emissionFactors[item.vehicle.toLowerCase()] * item.distance;
            return emission;
        });

        // Total emisi karbon dari semua transportasi
        const totalEmission = transportEmissions.reduce((sum, emission) => sum + emission, 0);
        console.log("Total emisi karbon dari transportasi:", totalEmission);

        // Mengembalikan total emisi dalam bentuk array
        return [totalEmission];
    } catch (error) {
        console.error("Error saat prediksi transport:", error);
        throw new Error('Prediction failed for transport');
    }
};

// Koneksi database untuk pengecekan
pool.query('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed', err));

// Endpoint untuk pendaftaran pengguna
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

// Endpoint untuk login pengguna
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

// Endpoint untuk menambahkan meal
app.post('/meals', async (req, res) => {
  const { userId, type } = req.body;
  
  try {
    // Cari id tipe meal berdasarkan tipe yang dipilih
    const [mealType] = await pool.query(
      'SELECT id FROM meal_types WHERE type = ?',
      [type]
    );

    if (mealType.length === 0) {
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    const mealTypeId = mealType[0].id;

    // Prediksi emisi karbon menggunakan model
    const model = await loadModels();  // Model akan dimuat di sini
    const prediction = await predictMeals(model.mealsModel, [{ food: type }]);

    // Menyimpan meal pilihan user ke database dengan emisi karbon hasil prediksi
    const [result] = await pool.query(
      'INSERT INTO meals (user_id, meal_type_id, carbonEmission) VALUES (?, ?, ?)',
      [userId, mealTypeId, prediction[0]] // Simpan hasil prediksi emisi
    );

    res.status(201).json({
      message: "Meal added successfully",
      meal: { type, userId, predictedEmission: prediction[0] }
    });
  } catch (err) {
    res.status(500).json({ message: "Error adding meal", error: err.message });
  }
});

// Endpoint untuk menambahkan transportasi
app.post('/transport', async (req, res) => {
  const { userId, type, distance } = req.body;

  try {
    // Cari id tipe transportasi berdasarkan tipe yang dipilih
    const [transportType] = await pool.query(
      'SELECT id FROM transport_types WHERE type = ?',
      [type]
    );

    if (transportType.length === 0) {
      return res.status(400).json({ error: 'Invalid transport type' });
    }

    const transportTypeId = transportType[0].id;

    // Prediksi emisi karbon menggunakan model
    const model = await loadModels();  // Model akan dimuat di sini
    const prediction = await predictTransport(model.transportModel, [{ vehicle: type, distance }]);

    // Menyimpan transportasi pilihan user ke database dengan emisi karbon hasil prediksi
    const [result] = await pool.query(
      'INSERT INTO transport (user_id, transport_type_id, distance, carbonEmission) VALUES (?, ?, ?, ?)',
      [userId, transportTypeId, distance, prediction[0]] // Simpan hasil prediksi emisi
    );

    res.status(201).json({
      message: "Transport added successfully",
      transport: { type, userId, distance, predictedEmission: prediction[0] }
    });
  } catch (err) {
    res.status(500).json({ message: "Error adding transport", error: err.message });
  }
});

// Endpoint Meals Recommendation
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

    // Menambahkan rekomendasi berdasarkan emisi karbon
    let mealRecommendation = '';
    mealResults.forEach(meal => {
      const carbonEmission = parseFloat(meal.carbonEmission);

      // Rekomendasi berdasarkan emisi karbon yang tinggi
      if (carbonEmission > 2.0) {
        mealRecommendation = "Your meal has a high carbon footprint. Consider switching to a Vegan or Vegetarian option.";
      } else if (carbonEmission > 1.0) {
        mealRecommendation = "Consider switching to a lower-carbon meal like Chicken or Fish.";
      } else {
        mealRecommendation = "Great choice! Your meal has a low carbon footprint.";
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

    // Menambahkan rekomendasi berdasarkan emisi karbon
    let transportRecommendation = '';
    transportResults.forEach(transport => {
      const carbonEmission = parseFloat(transport.carbonEmission);
      const distance = parseFloat(transport.distance);
      const totalEmission = carbonEmission * distance;

      if (totalEmission > 10) {
        transportRecommendation = "Your transport has a high carbon footprint. Consider using Public Transport or walking.";
      } else if (totalEmission > 5) {
        transportRecommendation = "Consider using a Bicycle or Public Transportation for a more eco-friendly option.";
      } else {
        transportRecommendation = "Great choice! Your transport is eco-friendly.";
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

    // Hitung total emisi karbon dari meal dengan prediksi yang disimpan
    mealResults.forEach(m => {
      const emission = parseFloat(m.carbonEmission);
      if (!isNaN(emission)) {
        totalCarbonEmission += emission;
      }
    });

    // Hitung total emisi karbon dari transport dengan prediksi yang disimpan
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
  console.log('Server running on port ${PORT}');
});
