import { Queue } from "bullmq";
import { createBullConnection } from "./redis";

export type JobName = "email" | "alert" | "rollup" | "trial-reminders";

export const QUEUE_NAME = "jobs";

const globalForQueue = globalThis as unknown as { jobQueue?: Queue };

function getQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!globalForQueue.jobQueue) {
    globalForQueue.jobQueue = new Queue(QUEUE_NAME, { connection: createBullConnection() });
  }
  return globalForQueue.jobQueue;
}

/**
 * İşi kuyruğa ekler. REDIS_URL yoksa (yerel geliştirme) iş aynı süreçte doğrudan çalıştırılır.
 * Kuyrukta 5 deneme ve üstel geri çekilme uygulanır.
 */
export async function enqueue(name: JobName, data: Record<string, unknown>): Promise<void> {
  const queue = getQueue();
  if (!queue) {
    const { processJob } = await import("./jobs/handlers");
    await processJob(name, data).catch((err) => console.error(`[job:${name}] satır içi çalıştırma hatası`, err));
    return;
  }
  await queue.add(name, data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  });
}
