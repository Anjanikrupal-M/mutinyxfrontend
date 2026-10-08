// ─────────────────────────────────────────────────────────────
// Shared API Response Types
// Matches the backend's standard envelope structure.
// ─────────────────────────────────────────────────────────────

export interface ApiMeta {
    page: number;
    limit: number;
    total: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: ApiMeta;
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

/** Paginated list response */
export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    meta: ApiMeta;
}
