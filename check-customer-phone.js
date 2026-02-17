const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const phoneNumber = process.argv[2] || '082214535152';

async function checkCustomer() {
  try {
    console.log(`\nSearching for customer with phone: ${phoneNumber}\n`);
    
    // Clean phone number
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    
    console.log('Search variations:');
    console.log('- Original:', phoneNumber);
    console.log('- Clean (62 format):', cleanPhone);
    console.log('- 08 format:', '0' + cleanPhone.substring(2));
    console.log('');
    
    const users = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { phone: phoneNumber },
          { phone: cleanPhone },
          { phone: '0' + cleanPhone.substring(2) },
          { phone: { contains: phoneNumber } },
          { phone: { contains: cleanPhone } },
        ],
      },
      select: {
        id: true,
        username: true,
        customerId: true,
        phone: true,
        name: true,
        status: true,
        expiredAt: true,
      },
    });
    
    if (users.length === 0) {
      console.log('❌ No customer found with this phone number');
      console.log('\nSearching all customers with similar phone...');
      
      const similar = await prisma.pppoeUser.findMany({
        where: {
          phone: { contains: phoneNumber.substring(3, 10) }
        },
        select: {
          id: true,
          username: true,
          customerId: true,
          phone: true,
          name: true,
        },
        take: 5
      });
      
      if (similar.length > 0) {
        console.log('\nSimilar phone numbers found:');
        similar.forEach(u => {
          console.log(`- ID: ${u.id}, Phone: ${u.phone}, Name: ${u.name}, Customer ID: ${u.customerId}`);
        });
      }
    } else {
      console.log(`✅ Found ${users.length} customer(s):\n`);
      users.forEach(user => {
        console.log('Customer Details:');
        console.log('- ID:', user.id);
        console.log('- Username:', user.username);
        console.log('- Customer ID:', user.customerId);
        console.log('- Phone:', user.phone);
        console.log('- Name:', user.name);
        console.log('- Status:', user.status);
        console.log('- Expired At:', user.expiredAt);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomer();
