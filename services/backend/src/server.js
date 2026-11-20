require('dotenv').config();
require('express-async-errors');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Ensure tmp/docs exists for document uploads
fs.mkdirSync(path.join(process.cwd(), 'tmp', 'docs'), { recursive: true });
const connectDB = require('./config/db');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const lectureRoutes = require('./routes/lectures');
const quizRoutes = require('./routes/quizzes');
const analyticsRoutes = require('./routes/analytics');
const documentRoutes = require('./routes/documents');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Trust Railway/Render/Vercel reverse proxy
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// ✅ CORS — lock to FRONTEND_URL in production
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : true, // allow all in dev
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // polling-friendly: ~1 req/2s sustained
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// ✅ Serve uploaded files
const __dirnameRoot = path.resolve();
app.use('/uploads', express.static(path.join(__dirnameRoot, 'uploads')));

// ✅ Health check
app.get('/', (req, res) => res.send('DocuMind API Running'));
app.get('/api/health', (req, res) => res.json({ ok: true, platform: 'DocuMind' }));

// ✅ API Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/lectures', apiLimiter, lectureRoutes);
app.use('/api/quizzes', apiLimiter, quizRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);
app.use('/api/documents', apiLimiter, documentRoutes);

// ✅ Error handler
app.use(errorHandler);

// ✅ Start Server (exactly once)
const PORT = parseInt(process.env.PORT || '5000', 10);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Invalid PORT value: ${process.env.PORT}`);
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartlecture';
let server = null;
let startPromise = null;
let isShuttingDown = false;

function describeListenError(err) {
  if (err.code === 'EADDRINUSE') {
    return `Port ${PORT} is already in use. Find the owner with: Get-NetTCPConnection -LocalPort ${PORT} | Select-Object LocalAddress,State,OwningProcess`;
  }
  if (err.code === 'EACCES') {
    return `Permission denied binding to port ${PORT}. Try a port above 1024 or run with appropriate privileges.`;
  }
  if (err.code === 'EADDRNOTAVAIL') {
    return `Address not available for port ${PORT}.`;
  }
  return err.message || String(err);
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('Shutting down server...');

  if (server && server.listening) {
    try {
      if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
      await new Promise((resolve) => server.close(() => resolve()));
    } catch (err) {
      console.error('Error while closing HTTP server:', err.message);
    }
  }

  try {
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error while disconnecting MongoDB:', err.message);
  }

  process.exit(exitCode);
}

function onServerError(err) {
  console.error(`Server listen error (${err.code || 'unknown'}): ${describeListenError(err)}`);
  shutdown(1);
}

async function bootstrap() {
  await connectDB(MONGO_URI);

  server = app.listen(PORT);
  server.on('error', onServerError);
  server.on('listening', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });

  return server;
}

function startServer() {
  if (!startPromise) {
    startPromise = bootstrap().catch((err) => {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    });
  }
  return startPromise;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

startServer();
