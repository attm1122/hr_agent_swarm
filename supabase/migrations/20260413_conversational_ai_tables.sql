-- Conversational AI: threads + messages for the LLM orchestrator.
--
-- Idempotent — safe to re-run. Includes RLS so a user can only read/write
-- their own threads, scoped per tenant.
--
-- RLS relies on the JWT helpers added in the main schema (`current_user_id`,
-- `current_tenant_id`, `is_admin`). Admins can read across users for support.

BEGIN;

CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  user_id         uuid NOT NULL,
  employee_id     uuid,
  title           text NOT NULL DEFAULT 'New conversation',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_user
  ON public.conversations (tenant_id, user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         jsonb NOT NULL,   -- Anthropic content-block array
  tool_calls      jsonb,            -- optional: ToolCallTrace[]
  usage           jsonb,            -- optional: { input_tokens, output_tokens }
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON public.chat_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant
  ON public.chat_messages (tenant_id, created_at DESC);

ALTER TABLE public.conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages  ENABLE ROW LEVEL SECURITY;

-- conversations: user can CRUD their own; admins can read all within tenant
DROP POLICY IF EXISTS conversations_user_rw ON public.conversations;
CREATE POLICY conversations_user_rw ON public.conversations
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND (user_id = public.current_user_id() OR public.is_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = public.current_user_id()
  );

-- chat_messages: access mirrors parent conversation
DROP POLICY IF EXISTS chat_messages_user_rw ON public.chat_messages;
CREATE POLICY chat_messages_user_rw ON public.chat_messages
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.tenant_id = chat_messages.tenant_id
        AND (c.user_id = public.current_user_id() OR public.is_admin())
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.tenant_id = chat_messages.tenant_id
        AND c.user_id = public.current_user_id()
    )
  );

-- updated_at trigger on conversations
DROP TRIGGER IF EXISTS conversations_set_updated_at ON public.conversations;
CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
