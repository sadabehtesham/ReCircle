require('dotenv').config({ quiet: true });

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || false, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/users', require('./routes/users'));
app.use('/api/requests', require('./routes/requests'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use(require('./middleware/errorHandler'));

module.exports = app;
