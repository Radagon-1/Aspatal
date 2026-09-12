import { Router } from 'express';
import {
  createHospital, getHospitals, getHospital,
  updateHospital, deleteHospital, getHospitalDashboard,
  searchHospitals,
} from '../controllers/hospital.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getHospitals);
router.get('/search', searchHospitals);
router.get('/:id', getHospital);
router.get('/:id/dashboard', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), getHospitalDashboard);

router.post('/', authenticate, authorize('ADMIN'), createHospital);
router.put('/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), updateHospital);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteHospital);

export default router;
