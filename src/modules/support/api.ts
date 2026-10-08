import { http } from '@/core/http';
import { API } from '@/core/api';

export const getSupportInfo = async () => {
    const res = await http.get(API.support.info);
    return res.data?.data;
};
