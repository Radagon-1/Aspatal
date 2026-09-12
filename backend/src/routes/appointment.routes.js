import { Router } from 'express';
import {
  bookAppointment, getAppointment, getAppointmentsByDoctor,
  getAppointmentsByPatient, getQueueByDoctor, updateAppointmentStatus,
  cancelAppointment, getTodayQueue,
} from '../controllers/appointment.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/patient/:patientId', authenticate, getAppointmentsByPatient);
router.get('/doctor/:doctorId', authenticate, getAppointmentsByDoctor);
router.get('/doctor/:doctorId/queue', authenticate, getQueueByDoctor);
router.get('/doctor/:doctorId/today', authenticate, getTodayQueue);
router.get('/:id', authenticate, getAppointment);

router.post('/', authenticate, bookAppointment);
router.patch('/:id/status', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), updateAppointmentStatus);
router.patch('/:id/cancel', authenticate, cancelAppointment);

export default router;
