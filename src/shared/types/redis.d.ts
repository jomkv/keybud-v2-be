// Auth
export type AuthNonceKey = `auth:nonce:${string}`;
export type AuthSocketKey = `auth:socket:${string}`;
export type AuthSessionKey = `auth:session:${string}`;

// Message
export type MessageCursorIdentifier = `${string}-${string}`; // userId-conversationId
export type MessageCursorKey = `message:cursor:${MessageCursorIdentifier}`;

// Attachments
export type AttachmentSignedUrlIdentifier = `${string}-${string}`; // userId-objectBuffer
export type AttachmentSignedUrl =
  `attachment:signed_url:${string}:${AttachmentSignedUrlIdentifier}`;
