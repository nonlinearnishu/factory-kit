import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// CLEAN: shared store, not a per-instance Map.
export const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "60 s"),
});
