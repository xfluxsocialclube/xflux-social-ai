/**
 * Contrato para a futura camada de IA. NENHUM modelo está conectado na Fase 2:
 * `aiProvider` é null e a interface mostra "IA não conectada".
 */
import type { MediaItem } from './library/types';

export interface AIAnalysis { products: string[]; categories: string[]; features: string[]; captions: string[]; hashtags: string[]; }
export interface AIProvider { id: string; analyze(item: MediaItem, file: Blob): Promise<AIAnalysis>; }

export let aiProvider: AIProvider | null = null;
export const registerAIProvider = (p: AIProvider) => { aiProvider = p; };
export const aiStatus = (): 'not-connected' | 'ready' => (aiProvider ? 'ready' : 'not-connected');
