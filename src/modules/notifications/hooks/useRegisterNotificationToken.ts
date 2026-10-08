import { useMutation } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import type { ApiResponse } from '@/core/types';

export function useRegisterNotificationToken() {
    return useMutation({
        mutationFn: async ({ token, deviceType }: { token: string; deviceType: 'web' | 'ios' | 'android' }) => {
            const { data } = await http.post<ApiResponse<unknown>>(API.notifications.registerToken, {
                token,
                deviceType,
            });
            return data.data;
        },
    });
}

