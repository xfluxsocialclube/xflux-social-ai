import { dbDelete, dbGetAll, dbPut } from '../db';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; }
export interface Conversation { id: string; title: string; updatedAt: string; messages: ChatMessage[]; }
export const newConversation = (): Conversation => ({ id: crypto.randomUUID(), title: '', updatedAt: new Date().toISOString(), messages: [] });
export async function listConversations(): Promise<Conversation[]> {
  return (await dbGetAll<Conversation>('conversations')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export const saveConversation = (c: Conversation) => dbPut('conversations', { ...c, updatedAt: new Date().toISOString() });
export const deleteConversation = (id: string) => dbDelete('conversations', id);
