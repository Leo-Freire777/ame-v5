-- ==========================================
-- SQL DE CRIAÇÃO DA TABELA DE EVENTOS (AME)
-- ==========================================

-- 1. Criação da Tabela
-- Garante que a tabela exista com as colunas e tipos especificados.
CREATE TABLE IF NOT EXISTS public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    event_date date NOT NULL,
    photos_url text,
    created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 2. Habilitação de Segurança (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de Policies (Garante idempotência ao rodar o script novamente)
DROP POLICY IF EXISTS "Permitir leitura para usuários aprovados" ON public.events;
DROP POLICY IF EXISTS "Permitir gerenciamento para admins aprovados" ON public.events;

-- 4. Criação de Policies baseadas no status e role do perfil (RBAC)

-- SELECT: Permite visualização para qualquer usuário com status 'APPROVED'.
CREATE POLICY "Permitir leitura para usuários aprovados" ON public.events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'APPROVED'
  )
);

-- ALL: Permite INSERT, UPDATE e DELETE apenas para usuários 'admin' ou 'superadmin' que estejam 'APPROVED'.
CREATE POLICY "Permitir gerenciamento para admins aprovados" ON public.events
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'APPROVED'
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'APPROVED'
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

-- 5. Criação do Índice de Performance
-- Otimiza a ordenação decrescente por data de evento utilizada no frontend.
CREATE INDEX IF NOT EXISTS idx_events_date_desc ON public.events (event_date DESC);

-- 6. Comentários de Banco de Dados
COMMENT ON TABLE public.events IS 'Armazena registros de ações especiais, campanhas e eventos da missão urbana.';
