import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin User ─────────────────────────────────────────
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@aspatal.in' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@aspatal.in',
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ─── Sample Hospital ─────────────────────────────────────
  const hospital = await prisma.hospital.upsert({
    where: { id: 'seed-hospital-1' },
    update: {},
    create: {
      id: 'seed-hospital-1',
      name: 'Nagpur District Government Hospital',
      address: 'Civil Lines, Nagpur',
      city: 'Nagpur',
      district: 'Nagpur',
      state: 'Maharashtra',
      pincode: '440001',
      phone: '+917122555000',
      frontDeskPhone: '+917122555001',
      email: 'nagpur.dgh@maha.gov.in',
      facilityLevel: 'DISTRICT_HOSPITAL',
      totalRooms: 80,
      totalBeds: 200,
      totalFloors: 4,
      totalStaff: 150,
    },
  });
  console.log(`✅ Hospital: ${hospital.name}`);

  // ─── Hospital Admin User ─────────────────────────────────
  const hospitalAdminHash = await bcrypt.hash('hospital123', 12);
  const hospitalAdminUser = await prisma.user.upsert({
    where: { email: 'admin@nagpur.dgh.in' },
    update: {},
    create: {
      email: 'admin@nagpur.dgh.in',
      passwordHash: hospitalAdminHash,
      role: 'HOSPITAL_ADMIN',
      isActive: true,
    },
  });
  await prisma.hospitalAdmin.upsert({
    where: { userId: hospitalAdminUser.id },
    update: {},
    create: { userId: hospitalAdminUser.id, hospitalId: hospital.id },
  });
  console.log(`✅ Hospital admin: ${hospitalAdminUser.email}`);

  // ─── Sample Doctor ───────────────────────────────────────
  const doctorHash = await bcrypt.hash('doctor123', 12);
  const doctorUser = await prisma.user.upsert({
    where: { email: 'dr.sharma@nagpur.dgh.in' },
    update: {},
    create: { email: 'dr.sharma@nagpur.dgh.in', passwordHash: doctorHash, role: 'DOCTOR' },
  });
  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      hospitalId: hospital.id,
      name: 'Dr. Priya Sharma',
      specialization: 'General Medicine',
      qualification: 'MBBS, MD',
      experience: 8,
      phone: '+917122555010',
      isAvailable: true,
      consultationFee: 0,
    },
  });
  console.log(`✅ Doctor: ${doctor.name}`);

  // ─── Sample ASHA Worker ──────────────────────────────────
  const ashaHash = await bcrypt.hash('asha123', 12);
  const ashaUser = await prisma.user.upsert({
    where: { email: 'asha.kavita@nagpur.in' },
    update: {},
    create: { email: 'asha.kavita@nagpur.in', passwordHash: ashaHash, role: 'ASHA_WORKER' },
  });
  await prisma.ashaWorker.upsert({
    where: { userId: ashaUser.id },
    update: {},
    create: {
      userId: ashaUser.id,
      name: 'Kavita Raut',
      phone: '+919876543210',
      assignedArea: 'Koradi Village',
      village: 'Koradi',
      district: 'Nagpur',
    },
  });
  console.log(`✅ ASHA worker: Kavita Raut`);

  // ─── Sample Beds ─────────────────────────────────────────
  const bedTypes = ['NORMAL', 'NORMAL', 'NORMAL', 'ICU', 'ICU', 'EMERGENCY', 'MATERNITY', 'NICU'];
  for (let i = 0; i < bedTypes.length; i++) {
    await prisma.bed.upsert({
      where: { hospitalId_bedNumber: { hospitalId: hospital.id, bedNumber: `B${String(i + 1).padStart(3, '0')}` } },
      update: {},
      create: {
        hospitalId: hospital.id,
        bedNumber: `B${String(i + 1).padStart(3, '0')}`,
        bedType: bedTypes[i],
        wardName: bedTypes[i] === 'ICU' ? 'ICU Ward' : bedTypes[i] === 'EMERGENCY' ? 'Emergency Ward' : 'General Ward',
        floor: bedTypes[i] === 'ICU' ? 3 : 1,
        status: 'AVAILABLE',
      },
    });
  }
  console.log(`✅ 8 sample beds created`);

  // ─── Sample Medicines ────────────────────────────────────
  const medicines = [
    { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic', quantity: 500, unit: 'tablets', reorderLevel: 50 },
    { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', category: 'Antibiotic', quantity: 200, unit: 'capsules', reorderLevel: 30 },
    { name: 'ORS Sachet', genericName: 'ORS', category: 'Rehydration', quantity: 8, unit: 'sachets', reorderLevel: 20 },
  ];
  for (const med of medicines) {
    await prisma.medicine.create({ data: { ...med, hospitalId: hospital.id } }).catch(() => {});
  }
  console.log(`✅ Sample medicines seeded`);

  console.log('\n🎉 Seed complete!');
  console.log('───────────────────────────────────');
  console.log('Admin login:         admin@aspatal.in / admin123');
  console.log('Hospital admin:      admin@nagpur.dgh.in / hospital123');
  console.log('Doctor login:        dr.sharma@nagpur.dgh.in / doctor123');
  console.log('ASHA worker login:   asha.kavita@nagpur.in / asha123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
