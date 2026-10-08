import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';

export interface AIChatSession {
    id: string;
    userId: string;
    title: string | null;
    status: 'in_progress' | 'completed';
    campaignId: string | null;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface AIChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}

export interface AIChatSessionDetail extends AIChatSession {
    messages: AIChatMessage[];
}

export function useAIChatSessions() {
    return useQuery({
        queryKey: ['ai-chat-sessions'],
        queryFn: async () => {
            const { data } = await http.get(API.ai.chatSessions.list);
            return data.data as AIChatSession[];
        },
        staleTime: 30_000,
    });
}

export function useAIChatSessionDetail(sessionId: string | null) {
    return useQuery({
        queryKey: ['ai-chat-session', sessionId],
        queryFn: async () => {
            const { data } = await http.get(API.ai.chatSessions.getById(sessionId!));
            return data.data as AIChatSessionDetail;
        },
        enabled: !!sessionId,
    });
}

export function useDeleteAIChatSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sessionId: string) => {
            await http.delete(API.ai.chatSessions.delete(sessionId));
            return sessionId;
        },
        onSuccess: (sessionId) => {
            queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] });
            queryClient.removeQueries({ queryKey: ['ai-chat-session', sessionId] });
        },
    });
}
