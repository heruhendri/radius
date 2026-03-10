const {PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
p.paymentGateway.findUnique({where:{provider:"duitku"}}).then(r=>{
  if(!r){console.log("NOT FOUND");p.$disconnect();return;}
  console.log(JSON.stringify({
    mc:r.duitkuMerchantCode,
    env:r.duitkuEnvironment,
    hasKey:!!r.duitkuApiKey,
    isActive:r.isActive
  }));
  p.$disconnect();
}).catch(e=>{console.log("ERR:"+e.message);p.$disconnect();});
