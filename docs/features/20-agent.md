# AI Assistant

## Description

AI Assistant is a chat workspace for finance-related conversations and guidance, with multi-session history. Users can create chats, switch between previous sessions, and delete sessions they no longer need.

## Benefits

- Keeps conversation history organized by session.
- Fast switching between active and past chats.
- Mobile-friendly split behavior between chat list and chat panel.

## Workflow

1. Open AI Assistant.
2. Click New Chat to start a fresh session.
3. Select any existing session card to load its message history.
4. Continue the conversation inside the chat panel.
5. Delete unwanted sessions from the session card action.

## User expectations

- Session list shows title, message count, and last-updated recency label.
- Current session is visibly highlighted.
- On mobile, users can toggle between list and chat cleanly.

## Dependencies

- `src/context/AgentContext.tsx` (`useAgentChat`)
- `src/components/agent/ChatWindow.tsx`
- `src/agent/types.ts` (`ChatSessionSummary`)

## Developer notes

- Implemented in `src/components/views/AgentView.tsx`.
- Session date labels are computed by `formatSessionDate` (today/yesterday/relative days).
- Current session state controls mobile panel visibility and active session styling.
