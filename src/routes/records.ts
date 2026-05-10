import { Router } from 'express';
import { syncRecords, getRecords } from '../controllers/recordController';
import { protect } from '../middleware/auth';

const router = Router();

// All record routes require authentication
// The protect middleware runs first, then the controller
router.post('/sync', protect, syncRecords);
router.get('/',     protect, getRecords);

export default router;