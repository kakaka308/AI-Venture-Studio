import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

/**
 * Redis 客户端单例（带优雅降级：未配置时短记忆功能自动关闭）
 */
let _redis: Redis | null = null;

function createRedis(): Redis | null {
  if (!REDIS_URL) {
    console.warn("[Memory] REDIS_URL 未配置，短期记忆已禁用");
    return null;
  }
  try {
    const redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.warn("[Memory] Redis 连接失败超过 3 次，停止重试");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("[Memory] Redis 错误:", err.message);
    });

    return redis;
  } catch {
    console.warn("[Memory] Redis 初始化失败，短期记忆已禁用");
    return null;
  }
}

// 懒初始化
export function getRedis(): Redis | null {
  if (_redis === undefined) {
    _redis = createRedis();
    // 异步连接（不阻塞启动）
    if (_redis) {
      _redis.connect().then(() => {
        console.log("[Memory] Redis 连接成功 ✓");
      }).catch((err) => {
        console.error("[Memory] Redis 连接失败:", err.message);
        _redis = null;
      });
    }
    // 将 undefined 转为 null 以便下次直接返回
    if (_redis === undefined) _redis = null;
  }
  return _redis;
}

export { type Redis };
