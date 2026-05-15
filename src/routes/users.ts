import { Router } from 'express';
import { getUsers, toggleUserActive } from '../controllers/userController';
import { protect, requireRole } from '../middleware/auth';
import { register } from '../controllers/authController';

const router = Router();

// All user management routes require authentication
router.use(protect);

// GET  /api/users          — manager + admin can list users
router.get('/', requireRole('manager', 'admin'), getUsers);

// POST /api/users          — admin only can create new users
router.post('/', requireRole('admin'), register);

// PATCH /api/users/:id/toggle — admin only can toggle active state
router.patch('/:id/toggle', requireRole('admin'), toggleUserActive);

export default router;
