require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const db = require('./models'); // loads models & associations

const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => res.json({ message: 'HR Analyzer API' }));

app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// Test DB connection and sync model definitions (no migrations, won't alter existing tables if they match)
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    // Note: we are not calling sequelize.sync({ force: true }) to avoid altering DB in production.
    // But we can sync models in development if needed:
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
