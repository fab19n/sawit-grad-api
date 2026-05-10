import { Router } from 'express';
import { login, getMe, register } from '../controllers/authController';
import { protect, requireRole } from '../middleware/auth';

const router = Router();

// Public route — no token needed
router.post('/login', login);

// Protected — only admins can create new users
router.post('/register', protect, requireRole('admin'), register);

// Protected — get own profile
router.get('/me', protect, getMe);

export default router;