import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';

export async function createHospital(req, res, next) {
  try {
    const hospital = await prisma.hospital.create({ data: req.body });
    res.status(201).json(hospital);
  } catch (err) { next(err); }
}

export async function getHospitals(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { state, district, facilityLevel } = req.query;

    const where = {
      isActive: true,
      ...(state && { state }),
      ...(district && { district }),
      ...(facilityLevel && { facilityLevel }),
    };

    const [hospitals, total] = await Promise.all([
      prisma.hospital.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.hospital.count({ where }),
    ]);
    res.json(paginatedResponse(hospitals, total, { page, limit }));
  } catch (err) { next(err); }
}

export async function getHospital(req, res, next) {
  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: req.params.id },
      include: { doctors: { where: { isAvailable: true }, take: 10 } },
    });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    res.json(hospital);
  } catch (err) { next(err); }
}

export async function searchHospitals(req, res, next) {
  try {
    const { q, facilityLevel } = req.query;
    const hospitals = await prisma.hospital.findMany({
      where: {
        isActive: true,
        ...(facilityLevel && { facilityLevel }),
        OR: q ? [
          { name: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { district: { contains: q, mode: 'insensitive' } },
        ] : undefined,
      },
      take: 20,
    });
    res.json(hospitals);
  } catch (err) { next(err); }
}

export async function updateHospital(req, res, next) {
  try {
    const hospital = await prisma.hospital.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(hospital);
  } catch (err) { next(err); }
}

export async function deleteHospital(req, res, next) {
  try {
    await prisma.hospital.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Hospital deactivated' });
  } catch (err) { next(err); }
}

export async function getHospitalDashboard(req, res, next) {
  try {
    const { id } = req.params;

    const [
      totalBeds, occupiedBeds,
      totalDoctors, availableDoctors,
      totalPatients,
      pendingReferrals, completedReferrals,
      todayAppointments,
      lowStockMedicines,
    ] = await Promise.all([
      prisma.bed.count({ where: { hospitalId: id } }),
      prisma.bed.count({ where: { hospitalId: id, status: 'OCCUPIED' } }),
      prisma.doctor.count({ where: { hospitalId: id } }),
      prisma.doctor.count({ where: { hospitalId: id, isAvailable: true } }),
      prisma.patient.count({ where: { hospitalId: id } }),
      prisma.referral.count({ where: { fromHospitalId: id, status: 'PENDING' } }),
      prisma.referral.count({ where: { fromHospitalId: id, status: 'COMPLETED' } }),
      prisma.appointment.count({
        where: {
          hospitalId: id,
          date: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date(new Date().setHours(23, 59, 59, 999)) },
        },
      }),
      prisma.medicine.count({ where: { hospitalId: id, quantity: { lte: prisma.medicine.fields.reorderLevel } } }),
    ]);

    // Bed breakdown by type
    const bedsByType = await prisma.bed.groupBy({
      by: ['bedType', 'status'],
      where: { hospitalId: id },
      _count: true,
    });

    res.json({
      beds: { total: totalBeds, occupied: occupiedBeds, available: totalBeds - occupiedBeds, byType: bedsByType },
      doctors: { total: totalDoctors, available: availableDoctors },
      patients: { total: totalPatients },
      referrals: { pending: pendingReferrals, completed: completedReferrals },
      appointments: { today: todayAppointments },
      inventory: { lowStockCount: lowStockMedicines },
    });
  } catch (err) { next(err); }
}
