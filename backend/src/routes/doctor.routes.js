import { Router } from 'express';
import {
  createDoctor, getDoctors, getDoctor, updateDoctor, deleteDoctor,
  getDoctorsByHospital, getDoctorsBySpecialization, toggleAvailability,
} from '../controllers/doctor.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getDoctors);
router.get('/specialization/:spec', getDoctorsBySpecialization);
router.get('/hospital/:hospitalId', getDoctorsByHospital);
router.get('/:id', getDoctor);

router.post('/', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), createDoctor);
router.put('/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), updateDoctor);
router.patch('/:id/availability', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), toggleAvailability);
router.delete('/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), deleteDoctor);

export default router;
