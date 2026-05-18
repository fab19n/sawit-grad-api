import { Router } from 'express';
import {
  syncRecords,
  getRecords,
  getLiteRecords,
  getConflicts,
  resolveConflict,
} from '../controllers/recordController';
import { protect, requireRole } from '../middleware/auth';

const router = Router();

router.post('/sync',                  protect, syncRecords);
router.get('/',                       protect, getRecords);
router.get('/lite',                   protect, getLiteRecords);
router.get('/conflicts',              protect, requireRole('manager', 'admin'), getConflicts);
router.patch('/:id/resolve-conflict', protect, requireRole('manager', 'admin'), resolveConflict);

export default router;