import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { NotificationsList } from "@/features/notifications/NotificationsList";

export default async function AdminNotifications() {
  const shop = await requireShop();
  const s = await requireRole("ADMIN");
  return <NotificationsList userId={s.user.id} tz={shop.timezone} />;
}
