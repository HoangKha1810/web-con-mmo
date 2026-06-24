import { fail, ok } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth';
import { getUpstreamBalance, upstreamInfo } from '@/lib/upstream';

export async function GET() {
  try {
    await requireAdmin();
    const balance = await getUpstreamBalance();
    return ok({
      balance,
      currency: 'VND',
      upstream: upstreamInfo(),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể lấy số dư nguồn', 403);
  }
}
