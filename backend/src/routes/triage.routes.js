import { Router } from 'express';
import { runTriage, getTriageHistory } from '../controllers/triage.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public triage — works offline too (client-side fallback in frontend)
router.post('/', authenticate, runTriage);
router.get('/patient/:patientId', authenticate, getTriageHistory);

export default router;
