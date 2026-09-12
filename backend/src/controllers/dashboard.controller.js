import prisma from '../config/db.js';

export async function getHospitalDashboardStats(req, res, next) {
  try {
    const { hospitalId } = req.params;

    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalPatients,
      activeAdmissions,
      todayVisits,
      weekVisits,
      pendingReferrals,
      incomingReferrals,
      todayAppointments,
      availableDoctors,
      bedSummary,
      lowStockCount,
    ] = await Promise.all([
      prisma.patient.count({ where: { hospitalId } }),
      prisma.admission.count({ where: { hospitalId, status: 'ADMITTED' } }),
      prisma.visit.count({ where: { hospitalId, visitDate: { gte: todayStart, lte: todayEnd } } }),
      prisma.visit.count({ where: { hospitalId, visitDate: { gte: weekAgo } } }),
      prisma.referral.count({ where: { fromHospitalId: hospitalId, status: 'PENDING' } }),
      prisma.referral.count({ where: { toHospitalId: hospitalId, status: { in: ['PENDING', 'ACCEPTED'] } } }),
      prisma.appointment.count({ where: { hospitalId, date: { gte: todayStart, lte: todayEnd } } }),
      prisma.doctor.count({ where: { hospitalId, isAvailable: true } }),
      prisma.bed.groupBy({ by: ['bedType', 'status'], where: { hospitalId }, _count: { id: true } }),
      prisma.medicine.findMany({ where: { hospitalId } }).then(meds => meds.filter(m => m.quantity <= m.reorderLevel).length),
    ]);

    res.json({
      patients: { total: totalPatients, activeAdmissions },
      visits: { today: todayVisits, thisWeek: weekVisits },
      referrals: { pending: pendingReferrals, incoming: incomingReferrals },
      appointments: { today: todayAppointments },
      doctors: { available: availableDoctors },
      beds: bedSummary,
      inventory: { lowStockCount },
    });
  } catch (err) { next(err); }
}

export async function getSystemStats(req, res, next) {
  try {
    const [hospitals, doctors, patients, visits, referrals] = await Promise.all([
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.doctor.count(),
      prisma.patient.count(),
      prisma.visit.count(),
      prisma.referral.groupBy({ by: ['status'], _count: { id: true } }),
    ]);

    res.json({
      hospitals,
      doctors,
      patients,
      visits,
      referralsByStatus: referrals,
    });
  } catch (err) { next(err); }
}

export async function getFacilityComparison(req, res, next) {
  try {
    const hospitals = await prisma.hospital.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, district: true, facilityLevel: true,
        totalBeds: true, totalDoctors: true,
        _count: { select: { patients: true, admissions: true } },
      },
    });
    res.json(hospitals);
  } catch (err) { next(err); }
}
