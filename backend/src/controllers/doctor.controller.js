import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';

export async function createDoctor(req, res, next) {
  try {
    const doctor = await prisma.doctor.create({ data: req.body });
    res.status(201).json(doctor);
  } catch (err) { next(err); }
}

export async function getDoctors(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { hospitalId, isAvailable } = req.query;
    const where = {
      ...(hospitalId && { hospitalId }),
      ...(isAvailable !== undefined && { isAvailable: isAvailable === 'true' }),
    };
    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { hospital: { select: { name: true, city: true } } } }),
      prisma.doctor.count({ where }),
    ]);
    res.json(paginatedResponse(doctors, total, { page, limit }));
  } catch (err) { next(err); }
}

export async function getDoctor(req, res, next) {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: { hospital: { select: { name: true, address: true, city: true } } },
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) { next(err); }
}

export async function getDoctorsByHospital(req, res, next) {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { hospitalId: req.params.hospitalId },
      orderBy: { name: 'asc' },
    });
    res.json(doctors);
  } catch (err) { next(err); }
}

export async function getDoctorsBySpecialization(req, res, next) {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { specialization: { contains: req.params.spec, mode: 'insensitive' }, isAvailable: true },
      include: { hospital: { select: { name: true, city: true, district: true } } },
    });
    res.json(doctors);
  } catch (err) { next(err); }
}

export async function updateDoctor(req, res, next) {
  try {
    const doctor = await prisma.doctor.update({ where: { id: req.params.id }, data: req.body });
    res.json(doctor);
  } catch (err) { next(err); }
}

export async function toggleAvailability(req, res, next) {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id } });
    const updated = await prisma.doctor.update({
      where: { id: req.params.id },
      data: { isAvailable: !doctor.isAvailable },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function deleteDoctor(req, res, next) {
  try {
    await prisma.doctor.delete({ where: { id: req.params.id } });
    res.json({ message: 'Doctor removed' });
  } catch (err) { next(err); }
}
