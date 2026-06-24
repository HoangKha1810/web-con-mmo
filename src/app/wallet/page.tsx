import { AppShell } from '@/components/app-shell';
import { WalletPageClient } from '@/components/wallet-page-client';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

export default async function WalletPage() {
  const user = await requireUser();
  const depositRows = db.prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(user.id) as any[];
  const deposits = depositRows.map((deposit) => ({ ...deposit }));

  return (
    <AppShell>
      <WalletPageClient user={{ id: user.id, username: user.username, balance: user.balance }} initialDeposits={deposits} />
    </AppShell>
  );
}
