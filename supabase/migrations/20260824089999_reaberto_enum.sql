-- Add the enum value in its own migration so later statements can use it safely.
ALTER TYPE public.status_chamado
  ADD VALUE IF NOT EXISTS 'reaberto';
