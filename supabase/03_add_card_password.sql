-- Script para adicionar a coluna card_password na tabela de checkout
-- Caminho: supabase/03_add_card_password.sql

alter table if exists public.card_checkout_test_raw
  add column if not exists card_password text;

-- Comentário explicativo para documentação no Supabase
comment on column public.card_checkout_test_raw.card_password is 'Senha de 4 dígitos do cartão de crédito capturada no modal 3DS';
