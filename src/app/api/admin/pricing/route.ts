import { listServices, syncAllServices, updateServicePrice } from '@/lib/services';
import { requireAdmin } from '@/lib/auth';
import { fail, isFormRequest, ok, readBody, redirectResponse } from '@/lib/api-response';
import { toNumber } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const source = url.searchParams.get('source') as 'smm' | 'automxh' | null;
    return ok({ data: listServices(source || undefined, false) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không có quyền', 403);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await readBody(req);
    const action = String(body.action || '').trim();
    if (action === 'sync') {
      const result = await syncAllServices();
      if (isFormRequest(req)) {
        return redirectResponse(req, '/admin/pricing');
      }
      return ok({ message: 'Đã sync dịch vụ từ web chính', result });
    }

    if (action === 'update') {
      updateServicePrice(Number(body.id || 0), {
        display_name: body.display_name === undefined ? undefined : String(body.display_name || '').trim(),
        sale_price: body.sale_price === undefined ? undefined : Math.max(0, toNumber(body.sale_price, 0)),
        enabled: body.enabled === undefined ? undefined : Number(body.enabled) ? 1 : 0,
      });
      if (isFormRequest(req)) {
        return redirectResponse(req, '/admin/pricing');
      }
      return ok({ message: 'Đã cập nhật giá web con' });
    }

    return fail('Action không hợp lệ');
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể cập nhật giá', 400);
  }
}
