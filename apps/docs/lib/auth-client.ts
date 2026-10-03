import { createClientAuth } from '@repo/auth/client';

export const authClient = createClientAuth(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
