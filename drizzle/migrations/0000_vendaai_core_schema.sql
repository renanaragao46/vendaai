
CREATE TYPE public.app_role AS ENUM ('OWNER','ADMIN','MANAGER','AGENT');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  segment text, description text, payment_methods text[] NOT NULL DEFAULT '{}',
  policies text, ai_tone text, onboarding_completed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, full_name text, email text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, role public.app_role NOT NULL DEFAULT 'AGENT',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX ON public.memberships(user_id);

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL, description text,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  promo_price numeric(12,2) CHECK (promo_price IS NULL OR promo_price >= 0),
  benefits text[] NOT NULL DEFAULT '{}', features text[] NOT NULL DEFAULT '{}',
  stock integer CHECK (stock IS NULL OR stock >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','DRAFT')),
  image_url text, checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.products(organization_id);

CREATE TABLE public.knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('COMPANY','FAQ','POLICY','OBJECTION','RULE')),
  title text NOT NULL, content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.knowledge_items(organization_id, kind);

CREATE TABLE public.agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_name text NOT NULL DEFAULT 'Assistente', personality text, tone text,
  emoji_usage text NOT NULL DEFAULT 'LOW' CHECK (emoji_usage IN ('NONE','LOW','MEDIUM','HIGH')),
  primary_objective text, target_audience text, language_rules text,
  words_to_use text[] NOT NULL DEFAULT '{}', words_to_avoid text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, phone text, email text, source text,
  tags text[] NOT NULL DEFAULT '{}', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.contacts(organization_id);

CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL, name text NOT NULL, position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title text NOT NULL,
  temperature text NOT NULL DEFAULT 'COLD' CHECK (temperature IN ('COLD','WARM','HOT')),
  assignee_id uuid, potential_value numeric(12,2) CHECK (potential_value IS NULL OR potential_value >= 0),
  last_interaction_at timestamptz, next_action text, next_action_at timestamptz, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.leads(organization_id, stage_id);

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, color text NOT NULL DEFAULT 'gray',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE TABLE public.lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, tag_id)
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','CANCELLED','REFUNDED')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'BRL', paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.orders(organization_id, status);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0), unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text, external_id text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','FAILED','REFUNDED')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpers
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE organization_id = _org AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _roles public.app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE organization_id = _org AND user_id = auth.uid() AND role = ANY(_roles))
$$;

-- Grants, RLS, updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','profiles','memberships','product_categories','products','knowledge_items','agent_configs','contacts','pipeline_stages','leads','tags','lead_tags','orders','order_items','payments'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
  -- Any member can read & write sales-ops tables
  FOREACH t IN ARRAY ARRAY['contacts','leads','tags','lead_tags'] LOOP
    EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "members insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "members update" ON public.%I FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "managers delete" ON public.%I FOR DELETE TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))', t);
  END LOOP;
  -- Members read; managers+ write
  FOREACH t IN ARRAY ARRAY['product_categories','products','knowledge_items','agent_configs','pipeline_stages','orders','order_items','payments'] LOOP
    EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "managers write" ON public.%I FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))', t);
  END LOOP;
END $$;

CREATE POLICY "members read org" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "admins update org" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, ARRAY['OWNER','ADMIN']::public.app_role[]))
  WITH CHECK (public.has_org_role(id, ARRAY['OWNER','ADMIN']::public.app_role[]));

CREATE POLICY "read own or co-member profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = profiles.id AND public.is_org_member(m.organization_id)));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "members read memberships" ON public.memberships FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "owner manages memberships" ON public.memberships FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['OWNER']::public.app_role[]))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER']::public.app_role[]));

-- Safe org creation RPC
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _full_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _name IS NULL OR char_length(trim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _uid AND role = 'OWNER') THEN
    RAISE EXCEPTION 'user already owns an organization';
  END IF;
  INSERT INTO public.profiles (id, full_name, email)
    VALUES (_uid, _full_name, (SELECT email FROM auth.users WHERE id = _uid))
    ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  INSERT INTO public.organizations (name, created_by) VALUES (trim(_name), _uid) RETURNING id INTO _org;
  INSERT INTO public.memberships (organization_id, user_id, role) VALUES (_org, _uid, 'OWNER');
  INSERT INTO public.pipeline_stages (organization_id, key, name, position) VALUES
    (_org,'NEW','Novo',1),(_org,'QUALIFYING','Qualificando',2),(_org,'INTERESTED','Interessado',3),
    (_org,'PRODUCT_PRESENTED','Produto apresentado',4),(_org,'OBJECTION','Objeção',5),
    (_org,'NEGOTIATION','Negociação',6),(_org,'CHECKOUT','Checkout',7),(_org,'PURCHASED','Comprou',8),
    (_org,'POST_SALE','Pós-venda',9),(_org,'LOST','Perdido',10);
  INSERT INTO public.agent_configs (organization_id) VALUES (_org);
  RETURN _org;
END; $$;
REVOKE ALL ON FUNCTION public.create_organization(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.app_role[]) TO authenticated;
