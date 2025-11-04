require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const db = require('./models'); // loads models & associations

const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// ✅ Enable CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ Built-in JSON & URL-encoded body parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Root endpoint
app.get('/', (req, res) => res.json({ message: 'HR Analyzer API' }));

// ✅ Mount routes
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// ✅ Database connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('Models synced (alter).');
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Unable to connect to DB:', err);
    process.exit(1);
  }
})();

module.exports = app;
