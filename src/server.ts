import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables before anything else
dotenv.config();

import authRoutes    from './routes/auth';
import recordRoutes  from './routes/records';
import userRoutes    from './routes/users';

const app  = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ── Security middleware ──────────────────────────────────────────────────────

// helmet adds ~15 security-related HTTP headers automatically
app.use(helmet());

// CORS — only allow requests from your app and your future dashboard
// In development, we allow all origins for convenience
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // In development or if no allowlist set, allow all
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.length === 0) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Rate limiting — max 100 requests per 15 minutes per IP
// This prevents brute force attacks on the login endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Terlalu banyak permintaan. Cuba lagi sebentar.' },
});
app.use('/api/', limiter);

// ── Body parsing ─────────────────────────────────────────────────────────────

// Increase the limit to 50mb to accommodate Base64 photo uploads
// A typical phone photo at 0.6 quality is about 200-400kb as Base64,
// so 3 photos per record = ~1.2mb max, well within this limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',    authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/users',   userRoutes);

// Health check endpoint — Render uses this to verify the service is alive
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for any route that doesn't match
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Laluan tidak dijumpai.' });
});

// ── Database connection ───────────────────────────────────────────────────────

async function connectDB(): Promise<void> {
  try {
    const uri = process.env.MONGODB_URI!;
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
      maxPoolSize:              10,
    } as mongoose.ConnectOptions);  // explicit cast resolves the type conflict
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}
// ── Start server ──────────────────────────────────────────────────────────────

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SawitGrad API running on port ${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV}`);
  });
});