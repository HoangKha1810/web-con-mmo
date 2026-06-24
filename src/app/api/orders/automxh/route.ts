import { requireUser } from '@/lib/auth';
import { fail, ok, readBody } from '@/lib/api-response';
import { createOrder, listUserOrders } from '@/lib/orders';

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ data: listUserOrders(user.id) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể tải đơn', 401);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(req);
    const result = await createOrder(user, {
      serviceId: Number(body.service_id || 0),
      link: String(body.link || ''),
      buyerInfo: String(body.buyer_info || ''),
      customValue: String(body.custom_value || ''),
    });
    return ok({ message: 'Đã tạo đơn AutoMXH', ...result });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể tạo đơn AutoMXH');
  }
}
