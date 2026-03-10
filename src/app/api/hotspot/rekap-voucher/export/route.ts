import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import ExcelJS from 'exceljs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const profileId = searchParams.get('profileId');

    // Get all batches with their vouchers grouped
    const batches = await prisma.hotspotVoucher.groupBy({
      by: ['batchCode', 'profileId', 'agentId', 'createdAt'],
      where: {
        batchCode: { not: null },
        ...(agentId && agentId !== 'all' ? { agentId } : {}),
        ...(profileId && profileId !== 'all' ? { profileId } : {}),
      },
      _count: {
        id: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get voucher counts per batch by status
    const rekapData = await Promise.all(
      batches.map(async (batch: any) => {
        const statusCounts = await prisma.hotspotVoucher.groupBy({
          by: ['status'],
          where: {
            batchCode: batch.batchCode,
          },
          _count: {
            id: true,
          },
        });

        const waiting = statusCounts.find((s: any) => s.status === 'WAITING')?._count.id || 0;
        const active = statusCounts.find((s: any) => s.status === 'ACTIVE')?._count.id || 0;
        const expired = statusCounts.find((s: any) => s.status === 'EXPIRED')?._count.id || 0;

        const profile = await prisma.hotspotProfile.findUnique({
          where: { id: batch.profileId },
          select: { id: true, name: true },
        });

        let agent = null;
        if (batch.agentId) {
          agent = await prisma.agent.findUnique({
            where: { id: batch.agentId },
            select: { id: true, name: true, phone: true },
          });
        }

        return {
          batchCode: batch.batchCode,
          createdAt: batch.createdAt,
          agentName: agent ? agent.name : 'Admin',
          agentPhone: agent ? agent.phone : '-',
          profileName: profile ? profile.name : 'Unknown',
          totalQty: batch._count.id,
          stock: waiting,
          sold: active + expired,
        };
      })
    );

    // Create Excel workbook using xlsx
    const worksheetData: any[] = [
      ['No', 'Kode Batch', 'Tanggal Pembuatan', 'Mitra/Agen', 'Telepon', 'Profile', 'Qty', 'Stok', 'Terjual'],
    ];

    // Add data rows
    rekapData.forEach((item, index) => {
      const date = new Date(item.createdAt);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      worksheetData.push([
        index + 1,
        item.batchCode,
        formattedDate,
        item.agentName,
        item.agentPhone,
        item.profileName,
        item.totalQty,
        item.stock,
        item.sold,
      ]);
    });

    // Add total row
    worksheetData.push([
      '',
      '',
      '',
      '',
      'TOTAL',
      '',
      rekapData.reduce((sum, item) => sum + item.totalQty, 0),
      rekapData.reduce((sum, item) => sum + item.stock, 0),
      rekapData.reduce((sum, item) => sum + item.sold, 0),
    ]);

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Voucher');

    // Set column widths
    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Kode Batch', key: 'batch', width: 15 },
      { header: 'Tanggal', key: 'date', width: 20 },
      { header: 'Agen', key: 'agent', width: 25 },
      { header: 'Telepon', key: 'phone', width: 15 },
      { header: 'Profile', key: 'profile', width: 15 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Stok', key: 'stock', width: 10 },
      { header: 'Terjual', key: 'sold', width: 10 },
    ];

    // Add data rows
    worksheetData.slice(1).forEach((row: any[]) => {
      const rowData: any = {};
      worksheet.columns.forEach((col, index) => {
        if (col.key) {
          rowData[col.key] = row[index] || '';
        }
      });
      worksheet.addRow(rowData);
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rekap-Voucher-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export rekap voucher error:', error);
    return NextResponse.json(
      { error: 'Failed to export rekap voucher' },
      { status: 500 }
    );
  }
}
