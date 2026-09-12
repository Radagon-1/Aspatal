import prisma from '../config/db.js';

// Generate next token number for doctor on a given date
async function getNextToken(doctorId, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const count = await prisma.appointment.count({
    where: { doctorId, date: { gte: start, lte: end } },
  });
  return count + 1;
}

export async function bookAppointment(req, res, next) {
  try {
    const { doctorId, date } = req.body;
    const tokenNumber = await getNextToken(doctorId, new Date(date));
    const appointment = await prisma.appointment.create({
      data: { ...req.body, tokenNumber },
      include: {
        doctor: { select: { name: true, specialization: true } },
        hospital: { select: { name: true } },
        patient: { select: { name: true } },
      },
    });
    res.status(201).json(appointment);
  } catch (err) { next(err); }
}

export async function getAppointment(req, res, next) {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { select: { name: true, specialization: true } },
        hospital: { select: { name: true } },
      },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appt);
  } catch (err) { next(err); }
}

export async function getAppointmentsByPatient(req, res, next) {
  try {
    const appts = await prisma.appointment.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { date: 'desc' },
      include: { doctor: { select: { name: true, specialization: true } }, hospital: { select: { name: true } } },
    });
    res.json(appts);
  } catch (err) { next(err); }
}

export async function getAppointmentsByDoctor(req, res, next) {
  try {
    const { date } = req.query;
    const appts = await prisma.appointment.findMany({
      where: {
        doctorId: req.params.doctorId,
        ...(date && {
          date: {
            gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
            lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
          },
        }),
      },
      orderBy: [{ date: 'asc' }, { tokenNumber: 'asc' }],
      include: { patient: { select: { name: true, phone: true } } },
    });
    res.json(appts);
  } catch (err) { next(err); }
}

export async function getTodayQueue(req, res, next) {
  try {
    const today = new Date();
    const appts = await prisma.appointment.findMany({
      where: {
        doctorId: req.params.doctorId,
        date: { gte: new Date(today.setHours(0, 0, 0, 0)), lte: new Date(today.setHours(23, 59, 59, 999)) },
        status: { in: ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'] },
      },
      orderBy: { tokenNumber: 'asc' },
      include: { patient: { select: { name: true } } },
    });
    res.json(appts);
  } catch (err) { next(err); }
}

export async function getQueueByDoctor(req, res, next) {
  try {
    return getTodayQueue(req, res, next);
  } catch (err) { next(err); }
}

export async function updateAppointmentStatus(req, res, next) {
  try {
    const appt = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        ...(req.body.status === 'CHECKED_IN' && { checkedInAt: new Date() }),
        ...(req.body.status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });
    res.json(appt);
  } catch (err) { next(err); }
}

export async function cancelAppointment(req, res, next) {
  try {
    const appt = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json(appt);
  } catch (err) { next(err); }
}
