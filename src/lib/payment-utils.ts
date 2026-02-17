import crypto from 'crypto';

/**
 * Generate payment token dan payment link untuk invoice
 */
export function generatePaymentData(baseUrl?: string) {
  const paymentToken = crypto.randomBytes(32).toString('hex');
  const url = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const paymentLink = `${url}/pay/${paymentToken}`;
  
  return {
    paymentToken,
    paymentLink,
  };
}
