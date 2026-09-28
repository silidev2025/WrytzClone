// Leave room for multipart headers below the serverless 4.5 MB request limit.
export const UPLOAD_BYTES = 4 * 1024 * 1024;
export const JSON_BODY_BYTES = 4_000_000;
