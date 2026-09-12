import { Router } from 'express';
import {
  registerAshaWorker, getAshaWorker, updateAshaWorker,
  createAshaVisit, getAshaVisits, syncAshaVisits,
  getAshaWorkerPatients,
} from '../controllers/asha.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/:id', authenticate, getAshaWorker);
router.get('/:id/patients', authenticate, getAshaWorkerPatients);
router.get('/:id/visits', authenticate, getAshaVisits);

router.post('/register', authenticate, authorize('ADMIN'), registerAshaWorker);
router.put('/:id', authenticate, authorize('ADMIN', 'ASHA_WORKER'), updateAshaWorker);

// Visits — works offline, sync on reconnect
router.post('/visits', authenticate, authorize('ASHA_WORKER', 'ADMIN'), createAshaVisit);
router.post('/visits/sync', authenticate, authorize('ASHA_WORKER', 'ADMIN'), syncAshaVisits);

export default router;
