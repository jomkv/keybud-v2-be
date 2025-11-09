// Auth
export type AuthNonceKey = `auth:nonce:${string}`;
export type AuthSocketKey = `auth:socket:${string}`;
export type AuthSessionKey = `auth:session:${string}`;

// Message
export type MessageCursorIdentifier = `${string}-${string}`; // userId-conversationId
export type MessageCursorKey = `message:cursor:${MessageCursorIdentifier}`;
