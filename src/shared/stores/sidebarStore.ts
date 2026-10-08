import { create } from 'zustand';

interface SidebarState {
    collapsed: boolean;
    toggleSidebar: () => void;
    setCollapsed: (collapsed: boolean) => void;
    /** True while the desktop rail is hover-expanded (68px → 240px).
     *  The rail is `fixed` and overlays page content, which is harmless on pages whose
     *  left edge is padding — but full-bleed pages (Messages) put interactive content
     *  under it. Those pages read this flag and inset themselves out of the way. */
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
    collapsed: true,
    toggleSidebar: () => set((state) => ({ collapsed: !state.collapsed })),
    setCollapsed: (collapsed) => set({ collapsed }),
    expanded: false,
    setExpanded: (expanded) => set({ expanded }),
}));
