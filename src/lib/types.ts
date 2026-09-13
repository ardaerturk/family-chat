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
export type Preferences = { language: "en" | "tr" };
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
};
export type ConversationSummary = Omit<Conversation, "messages">;
export type SessionView = {
  id: string;
  device: string;
  createdAt: string;
  expiresAt: number;
  current: boolean;
};
