import prisma from '../config/db.js';

// ─── Medicines ─────────────────────────────────────────────
export async function getMedicines(req, res, next) {
  try {
    const { available } = req.query;
    const medicines = await prisma.medicine.findMany({
      where: { hospitalId: req.params.hospitalId, ...(available !== undefined && { isAvailable: available === 'true' }) },
      orderBy: { name: 'asc' },
    });
    res.json(medicines);
  } catch (err) { next(err); }
}

export async function getLowStock(req, res, next) {
  try {
    const medicines = await prisma.medicine.findMany({
      where: { hospitalId: req.params.hospitalId },
    });
    const lowStock = medicines.filter(m => m.quantity <= m.reorderLevel);
    res.json(lowStock);
  } catch (err) { next(err); }
}

export async function createMedicine(req, res, next) {
  try {
    const med = await prisma.medicine.create({ data: req.body });
    res.status(201).json(med);
  } catch (err) { next(err); }
}

export async function updateMedicine(req, res, next) {
  try {
    const med = await prisma.medicine.update({ where: { id: req.params.id }, data: req.body });
    res.json(med);
  } catch (err) { next(err); }
}

export async function deleteMedicine(req, res, next) {
  try {
    await prisma.medicine.delete({ where: { id: req.params.id } });
    res.json({ message: 'Medicine deleted' });
  } catch (err) { next(err); }
}

// ─── Machines ──────────────────────────────────────────────
export async function getMachines(req, res, next) {
  try {
    const machines = await prisma.machine.findMany({
      where: { hospitalId: req.params.hospitalId },
      orderBy: { name: 'asc' },
    });
    res.json(machines);
  } catch (err) { next(err); }
}

export async function createMachine(req, res, next) {
  try {
    const machine = await prisma.machine.create({ data: req.body });
    res.status(201).json(machine);
  } catch (err) { next(err); }
}

export async function updateMachine(req, res, next) {
  try {
    const machine = await prisma.machine.update({ where: { id: req.params.id }, data: req.body });
    res.json(machine);
  } catch (err) { next(err); }
}

// ─── Pharmacy ──────────────────────────────────────────────
export async function getPharmacy(req, res, next) {
  try {
    const pharmacy = await prisma.pharmacy.findFirst({ where: { hospitalId: req.params.hospitalId } });
    res.json(pharmacy || null);
  } catch (err) { next(err); }
}

export async function upsertPharmacy(req, res, next) {
  try {
    const existing = await prisma.pharmacy.findFirst({ where: { hospitalId: req.params.hospitalId } });
    let pharmacy;
    if (existing) {
      pharmacy = await prisma.pharmacy.update({ where: { id: existing.id }, data: req.body });
    } else {
      pharmacy = await prisma.pharmacy.create({ data: { ...req.body, hospitalId: req.params.hospitalId } });
    }
    res.json(pharmacy);
  } catch (err) { next(err); }
}
