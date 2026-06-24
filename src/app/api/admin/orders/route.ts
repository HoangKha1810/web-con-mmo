import { requireAdmin } from '@/lib/auth';
import { fail, isFormRequest, ok, readBody, redirectResponse } from '@/lib/api-response';
import { listAllOrders, refreshOrderStatus } from '@/lib/orders';

export async function GET() {
  try {
    await requireAdmin();
    return ok({ data: listAllOrders() });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không có quyền', 403);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await readBody(req);
    const order = await refreshOrderStatus(Number(body.id || 0));
    if (isFormRequest(req)) {
      return redirectResponse(req, '/admin/orders');
    }
    return ok({ order });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể cập nhật đơn', 400);
  }
}
