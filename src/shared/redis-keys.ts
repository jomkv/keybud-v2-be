export const REDIS_KEYS = {
  ATTACHMENT: {
    SIGNED_URL: (userId: number, objectKey: string) =>
      `attachment:signed_url:${userId}:${Buffer.from(objectKey).toString('base64')}`,
  },

  MESSAGE: {
    USER_TO_SOCKET: (userId: number) => `message:user:${userId}`,
    SOCKET_TO_USER: (socketId: string) => `message:socket:${socketId}`,
  },
} as const;
