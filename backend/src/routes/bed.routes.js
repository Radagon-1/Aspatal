import { Router } from 'express';
import {
  getBeds, getBed, createBed, updateBed, deleteBed,
  getBedsByHospital, getOccupancySummary, updateBedStatus,
} from '../controllers/bed.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/hospital/:hospitalId', authenticate, getBedsByHospital);
router.get('/hospital/:hospitalId/summary', authenticate, getOccupancySummary);
router.get('/:id', authenticate, getBed);

router.post('/', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), createBed);
router.post('/bulk', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), getBeds); // bulk create
router.patch('/:id/status', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), updateBedStatus);
router.put('/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), updateBed);
router.delete('/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), deleteBed);

export default router;
