// Kuyruk işçisi: e-posta, uyarı dağıtımı ve zamanlanmış işler.
// Çalıştırma: npm run worker   (ayrı bir süreç/konteyner olarak)
import { Queue, Worker } from "bullmq";
import { processJob } from "../lib/jobs/handlers";
import { QUEUE_NAME } from "../lib/queue";
import { createBullConnection } from "../lib/redis";

async function main() {
  const worker = new Worker(QUEUE_NAME, (job) => processJob(job.name, job.data), {
    connection: createBullConnection(),
    concurrency: 5,
  });

  worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} başarısız:`, err.message));
  worker.on("ready", () => console.log("[worker] hazır"));

  // Zamanlanmış işler (aynı kimlikle tekrar kaydedilirse güncellenir, çoğalmaz)
  const queue = new Queue(QUEUE_NAME, { connection: createBullConnection() });
  await queue.upsertJobScheduler("rollup-every-5m", { every: 5 * 60_000 }, { name: "rollup", data: {} });
  await queue.upsertJobScheduler("trial-reminders-hourly", { every: 60 * 60_000 }, { name: "trial-reminders", data: {} });

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
