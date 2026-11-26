/** Execução manual da fila: npm run notifications:run */
import { prisma } from "../db";
import { processOutbox } from "../services/notifications";
import { queueReminders } from "../services/appointments";

(async () => {
  const reminders = await queueReminders(24);
  const delivery = await processOutbox(200);
  console.log({ reminders, delivery });
  await prisma.$disconnect();
})();
