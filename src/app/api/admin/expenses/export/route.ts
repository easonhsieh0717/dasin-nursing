import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdvanceExpenses } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';

const TYPE_LABELS: Record<string, string> = { meal: '餐費', transport: '車資', advance: '代墊費', other: '其它' };
const STATUS_LABELS: Record<string, string> = { pending: '待審核', approved: '已通過', rejected: '已拒絕' };

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const requests = await getAdvanceExpenses(session.orgId, { caseId, status, startDate, endDate });

    // Enrich with user/case names + signed image URLs
    let enriched: (typeof requests[0] & { userName?: string; caseName?: string })[] = requests;
    if (isSupabase && requests.length > 0) {
      const userIds = [...new Set(requests.map(r => r.userId))];
      const caseIds = [...new Set(requests.map(r => r.caseId))];
      const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
      const { data: cases } = await supabase.from('cases').select('id, name').in('id', caseIds);
      const userMap = new Map((users || []).map((u: { id: string; name: string }) => [u.id, u.name]));
      const caseMap = new Map((cases || []).map((c: { id: string; name: string }) => [c.id, c.name]));
      enriched = await Promise.all(requests.map(async (r) => {
        let imageUrl = r.imageUrl;
        if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
          const { data: signedData } = await supabase.storage.from('expense-images').createSignedUrl(imageUrl, 7 * 24 * 3600);
          imageUrl = signedData?.signedUrl || imageUrl;
        }
        return {
          ...r,
          imageUrl,
          userName: userMap.get(r.userId) || '未知',
          caseName: caseMap.get(r.caseId) || '未知',
        };
      }));
    }

    const total = enriched.reduce((s, r) => s + r.amount, 0);
    const today = new Date().toISOString().slice(0, 10);
    const dateRange = startDate && endDate ? `${startDate} ~ ${endDate}` : startDate ? `${startDate} 起` : endDate ? `至 ${endDate}` : '全部';

    // Get case name for header if filtered by caseId
    let caseName = '';
    if (caseId && isSupabase) {
      const { data: caseData } = await supabase.from('cases').select('name, code').eq('id', caseId).single();
      if (caseData) caseName = `${caseData.name}（${caseData.code}）`;
    } else if (caseId && enriched.length > 0) {
      caseName = (enriched[0] as { caseName?: string }).caseName || '';
    }

    // Build printable HTML with embedded images
    const rows = enriched.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.expenseDate}</td>
        <td>${r.userName || ''}</td>
        <td>${r.caseName || ''}</td>
        <td>${TYPE_LABELS[r.expenseType] || r.expenseType}</td>
        <td class="amount">NT$ ${r.amount.toLocaleString()}</td>
        <td>${r.description || '—'}</td>
        <td>${STATUS_LABELS[r.status] || r.status}</td>
      </tr>`).join('');

    // Image section: group images per expense
    const withImages = enriched.filter(r => r.imageUrl && r.imageUrl.trim() !== '');
    console.log(`[Export] Total: ${enriched.length}, With images: ${withImages.length}, imageUrls:`, enriched.map(r => r.imageUrl || '(empty)'));
    const imageItems = withImages
      .map((r) => `
        <div class="img-item">
          <div class="img-label">#${enriched.indexOf(r) + 1} ${r.expenseDate} / ${(r as { userName?: string }).userName || ''} / ${TYPE_LABELS[r.expenseType] || r.expenseType} / NT$ ${r.amount.toLocaleString()}</div>
          <img src="${r.imageUrl}" alt="收據" />
        </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>代墊費用明細_${today}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif; color: #333; padding: 20px; }

  .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #d4635b; padding-bottom: 16px; }
  .header h1 { font-size: 22px; color: #d4635b; margin-bottom: 4px; }
  .header .case-name { font-size: 17px; font-weight: 600; color: #333; margin-bottom: 4px; }
  .header .meta { font-size: 13px; color: #666; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
  th { background: #f9e8e5; color: #333; padding: 8px 6px; border: 1px solid #ddd; text-align: center; font-weight: 600; }
  td { padding: 7px 6px; border: 1px solid #ddd; text-align: center; }
  td.amount { text-align: right; font-weight: 600; }
  .total-row { background: #fdf5f3; font-weight: 700; }
  .total-row td { border-top: 2px solid #d4635b; }

  .images-section { margin-top: 24px; }
  .images-section h2 { font-size: 16px; color: #d4635b; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .img-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .img-item { page-break-inside: avoid; }
  .img-label { font-size: 11px; color: #666; margin-bottom: 4px; font-weight: 600; }
  .img-item img { width: 100%; max-height: 300px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }

  .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }

  .no-print { text-align: center; margin-bottom: 20px; }
  .no-print button { padding: 10px 30px; background: #d4635b; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; font-weight: 600; }
  .no-print button:hover { background: #c0544d; }

  @media print {
    .no-print { display: none; }
    body { padding: 0; }
    .img-item { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">列印 / 儲存 PDF</button>
  </div>

  <div class="header">
    <h1>代墊費用明細</h1>
    ${caseName ? `<div class="case-name">個案：${caseName}</div>` : ''}
    <div class="meta">期間：${dateRange}　|　匯出日期：${today}　|　共 ${enriched.length} 筆　|　合計 NT$ ${total.toLocaleString()}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>日期</th>
        <th>特護</th>
        <th>個案</th>
        <th>類型</th>
        <th>金額</th>
        <th>說明</th>
        <th>狀態</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="5">合計</td>
        <td class="amount">NT$ ${total.toLocaleString()}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  ${imageItems ? `
  <div class="images-section">
    <h2>收據附件</h2>
    <div class="img-grid">
      ${imageItems}
    </div>
  </div>` : ''}

  <div class="footer">達心特護打卡系統 — 代墊費用報表</div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('Expenses export error:', err);
    return NextResponse.json({ error: '匯出失敗' }, { status: 500 });
  }
}
