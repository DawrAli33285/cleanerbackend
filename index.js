require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

app.use(express.json());
app.use(cors());
app.use('/files', express.static('/tmp/public/files'));

const sequelize = require('./db');
const models = require('./models'); // ← import once, pass everywhere

sequelize.authenticate()
  .then(() => console.log('MySQL connected.'))
  .catch((err) => console.error('Connection failed:', err));

sequelize.sync({ force: false })
  .then(() => console.log('Tables synced.'))
  .catch((err) => console.error('Sync failed:', err));

const authRoutes    = require('./routes/auth');
const requestRoutes = require('./routes/request');
const adminRoutes   = require('./routes/admin');

app.use('/api', authRoutes);           // plain router, no change
app.use('/api', requestRoutes);        // plain router, no change  
app.use('/api/admin', adminRoutes(models));
app.listen(5000, () => console.log('Listening on port 5000'));