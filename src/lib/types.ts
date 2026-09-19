export type Model = {
  id: string;
  label: string;
  description: string;
  reasoning: boolean;
};
export type Person = {
  id: string;
  name: string;
  role: "owner" | "member";
  disabled?: boolean;
  createdAt: string;
};
export type Attachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
};
export type Source = { url: string; title: string };
export type MemorySettings = {
  enabled: boolean;
  use: boolean;
  generate: boolean;
  excludeSearch: boolean;
};
export type Preferences = { language: "en" | "tr"; memory?: MemorySettings };
export type Folder = { id: string; name: string; createdAt: string };
export type MemoryEntry = {
  id: string;
  text: string;
  updatedAt: string;
  sourceChatId?: string;
  sourceMessageId?: string;
  quote?: string;
};
export type MemoryState = {
  revision: number;
  cutoff: number;
  summary: string;
  entries: MemoryEntry[];
  blockedSources: string[];
  updatedAt?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Attachment[];
  sources?: Source[];
  searched?: boolean;
  model?: string;
  status?: "complete" | "stopped" | "error";
  createdAt: string;
};
export type Conversation = {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  updatedAt: string;
  pinned?: boolean;
  temporary?: boolean;
  folderId?: string | null;
  useMemory?: boolean;
  generateMemory?: boolean;
  memoryEligibleAt?: string;
};
export type ConversationSummary = Omit<Conversation, "messages">;
export type SessionView = {
  id: string;
  device: string;
  createdAt: string;
  expiresAt: number;
  current: boolean;
};
