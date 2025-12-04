export const REDIS_KEYS = {
  ATTACHMENT: {
    SIGNED_URL: (userId: number, objectKey: string) =>
      `attachment:signed_url:${userId}:${Buffer.from(objectKey).toString('base64')}`,
  },

  // ... other modules
} as const;
