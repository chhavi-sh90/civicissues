// src/app.js
// Configures the Express application (no listen() here — that's in
// server.js so app.js stays testable with supertest).

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes'); // src/routes/index.js

const app = express();

// --- Security & parsing middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Request logging ---
app.use(
  morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// --- Static file serving for locally-uploaded complaint images ---
app.use('/uploads', express.static(path.join(process.cwd(), env.LOCAL_UPLOAD_DIR)));

// --- Health check (useful for Postman / uptime checks / Flutter dev testing) ---
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Civic Connect API is running' });
});

// --- API routes ---
app.use('/api', routes);

// --- 404 handler for unmatched routes ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// --- Centralized error handler (must be last) ---
app.use(errorHandler);

module.exports = app;
