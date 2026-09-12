import { Router } from 'express';
import {
  createFollowUp, getFollowUp, getFollowUpsByPatient,
  getUpcomingFollowUps, markFollowUpComplete,
} from '../controllers/followup.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/patient/:patientId', authenticate, getFollowUpsByPatient);
router.get('/upcoming/hospital/:hospitalId', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), getUpcomingFollowUps);
router.get('/:id', authenticate, getFollowUp);

router.post('/', authenticate, authorize('ADMIN', 'DOCTOR'), createFollowUp);
router.patch('/:id/complete', authenticate, authorize('ADMIN', 'DOCTOR'), markFollowUpComplete);

export default router;
