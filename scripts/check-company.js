const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

async function checkCompany() {
  try {
    const count = await prisma.company.count();
    console.log('Company records:', count);
    
    if (count === 0) {
      console.log('\n❌ No company record found!');
      console.log('Creating default company...');
      
      const company = await prisma.company.create({
        data: {
          id: randomUUID(),
          name: 'Default Company',
          isolationEnabled: true,
          isolationIpPool: '192.168.200.0/24',
          isolationRateLimit: '64k/64k',
          isolationAllowDns: true,
          isolationAllowPayment: true,
          isolationNotifyWhatsapp: false,
          isolationNotifyEmail: false,
          gracePeriodDays: 0,
          baseUrl: 'http://localhost:3000',
        }
      });
      
      console.log('✅ Company created:', company.name);
    } else {
      const company = await prisma.company.findFirst();
      console.log('✅ Company exists:', company.name);
      console.log('Isolation settings:');
      console.log('- isolationEnabled:', company.isolationEnabled);
      console.log('- isolationIpPool:', company.isolationIpPool);
      console.log('- isolationRateLimit:', company.isolationRateLimit);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCompany();
