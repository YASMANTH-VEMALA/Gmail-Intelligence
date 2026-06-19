import { create } from 'zustand';
import type { EmailMessage, EmailThread, ChatMessage, EmailCategory } from '@/types';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  createdAt: number;
}

interface AppState {
  // User
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userPicture: string | null;
  setUser: (userId: string, email: string, name: string | null, picture: string | null) => void;
  clearUser: () => void;

  // Emails
  emails: EmailMessage[];
  threads: EmailThread[];
  selectedEmail: EmailMessage | null;
  selectedThread: EmailThread | null;
  threadMessages: EmailMessage[];
  totalEmails: number;
  currentPage: number;
  activeCategory: EmailCategory | 'all';
  searchQuery: string;
  isThreadView: boolean;
  setEmails: (emails: EmailMessage[], total: number) => void;
  setThreads: (threads: EmailThread[], total: number) => void;
  setSelectedEmail: (email: EmailMessage | null) => void;
  setSelectedThread: (thread: EmailThread | null, messages?: EmailMessage[]) => void;
  setCurrentPage: (page: number) => void;
  setActiveCategory: (category: EmailCategory | 'all') => void;
  setSearchQuery: (query: string) => void;
  setIsThreadView: (isThread: boolean) => void;

  // Chat
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  addChatMessage: (message: ChatMessage) => void;
  setChatOpen: (open: boolean) => void;
  clearChat: () => void;

  // UI State
  isSyncing: boolean;
  syncProgress: string;
  isComposing: boolean;
  isReplying: boolean;
  sidebarOpen: boolean;
  isTerminalOpen: boolean;
  replyBody: string;
  composeBody: string;
  composeTo: string;
  composeSubject: string;
  setIsSyncing: (syncing: boolean, progress?: string) => void;
  setIsComposing: (composing: boolean) => void;
  setIsReplying: (replying: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  setReplyBody: (body: string) => void;
  setComposeBody: (body: string) => void;
  setComposeTo: (to: string) => void;
  setComposeSubject: (subject: string) => void;

  // Category counts
  categoryCounts: Record<string, number>;
  setCategoryCounts: (counts: Record<string, number>) => void;

  // Autopilot State
  autopilotState: {
    active: boolean;
    type: 'reply' | 'compose' | null;
    step: 'none' | 'moving_to_button' | 'typing' | 'done';
    text: string;
    targetSelector: string;
    cursorX: number;
    cursorY: number;
  };
  startAutopilot: (type: 'reply' | 'compose', targetSelector: string, text: string) => void;
  updateAutopilotCursor: (x: number, y: number) => void;
  setAutopilotStep: (step: 'none' | 'moving_to_button' | 'typing' | 'done') => void;
  endAutopilot: () => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User
  userId: null,
  userEmail: null,
  userName: null,
  userPicture: null,
  setUser: (userId, email, name, picture) => set({ userId, userEmail: email, userName: name, userPicture: picture }),
  clearUser: () => set({ userId: null, userEmail: null, userName: null, userPicture: null }),

  // Emails
  emails: [],
  threads: [],
  selectedEmail: null,
  selectedThread: null,
  threadMessages: [],
  totalEmails: 0,
  currentPage: 1,
  activeCategory: 'all',
  searchQuery: '',
  isThreadView: true,
  setEmails: (emails, total) => set({ emails, totalEmails: total }),
  setThreads: (threads, total) => set({ threads, totalEmails: total }),
  setSelectedEmail: (email) => set({ selectedEmail: email }),
  setSelectedThread: (thread, messages) => set({ selectedThread: thread, threadMessages: messages || [] }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setActiveCategory: (category) => set({ activeCategory: category, currentPage: 1 }),
  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  setIsThreadView: (isThread) => set({ isThreadView: isThread }),

  // Chat
  chatMessages: [],
  isChatOpen: false,
  addChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  setChatOpen: (open) => set({ isChatOpen: open }),
  clearChat: () => set({ chatMessages: [] }),

  // UI State
  isSyncing: false,
  syncProgress: '',
  isComposing: false,
  isReplying: false,
  sidebarOpen: true,
  isTerminalOpen: false,
  replyBody: '',
  composeBody: '',
  composeTo: '',
  composeSubject: '',
  setIsSyncing: (syncing, progress) => set({ isSyncing: syncing, syncProgress: progress || '' }),
  setIsComposing: (composing) => set({ isComposing: composing }),
  setIsReplying: (replying) => set({ isReplying: replying }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTerminalOpen: (open) => set({ isTerminalOpen: open }),
  setReplyBody: (body) => set({ replyBody: body }),
  setComposeBody: (body) => set({ composeBody: body }),
  setComposeTo: (to) => set({ composeTo: to }),
  setComposeSubject: (subject) => set({ composeSubject: subject }),

  // Category counts
  categoryCounts: {},
  setCategoryCounts: (counts) => set({ categoryCounts: counts }),

  // Autopilot State
  autopilotState: {
    active: false,
    type: null,
    step: 'none',
    text: '',
    targetSelector: '',
    cursorX: 0,
    cursorY: 0,
  },
  startAutopilot: (type, targetSelector, text) => set({
    autopilotState: {
      active: true,
      type,
      step: 'moving_to_button',
      text,
      targetSelector,
      cursorX: typeof window !== 'undefined' ? window.innerWidth - 300 : 500, // Start near the Chat Panel
      cursorY: typeof window !== 'undefined' ? window.innerHeight - 200 : 500,
    }
  }),
  updateAutopilotCursor: (x, y) => set((state) => ({
    autopilotState: { ...state.autopilotState, cursorX: x, cursorY: y }
  })),
  setAutopilotStep: (step) => set((state) => ({
    autopilotState: { ...state.autopilotState, step }
  })),
  endAutopilot: () => set((state) => ({
    autopilotState: {
      ...state.autopilotState,
      active: false,
      type: null,
      step: 'none',
    }
  })),

  // Toast notifications
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, type, createdAt: Date.now() }] }));
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
