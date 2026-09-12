import { Router } from 'express';
import {
  getMedicines, createMedicine, updateMedicine, deleteMedicine, getLowStock,
  getMachines, createMachine, updateMachine,
  getPharmacy, upsertPharmacy,
} from '../controllers/inventory.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// ─── Medicines ─────────────────────────────────────────────
router.get('/medicines/hospital/:hospitalId', authenticate, getMedicines);
router.get('/medicines/hospital/:hospitalId/low-stock', authenticate, getLowStock);
router.post('/medicines', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), createMedicine);
router.put('/medicines/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), updateMedicine);
router.delete('/medicines/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), deleteMedicine);

// ─── Machines ──────────────────────────────────────────────
router.get('/machines/hospital/:hospitalId', authenticate, getMachines);
router.post('/machines', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), createMachine);
router.put('/machines/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), updateMachine);

// ─── Pharmacy ──────────────────────────────────────────────
router.get('/pharmacy/hospital/:hospitalId', authenticate, getPharmacy);
router.put('/pharmacy/hospital/:hospitalId', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), upsertPharmacy);

export default router;
