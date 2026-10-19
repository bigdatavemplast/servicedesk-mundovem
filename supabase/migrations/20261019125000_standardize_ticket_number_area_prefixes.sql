-- Padroniza os códigos de área usados nos protocolos dos chamados.
-- O protocolo é montado por chamado_numero_global como SD-<CODIGO>-<SEQUENCIAL>.
-- Inclui Logística, que antes caía no fallback "SD" e gerava SD-SD.

CREATE OR REPLACE FUNCTION public.codigo_area_chamado(p_segmento_id uuid)
RETURNS character varying
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE LOWER(BTRIM(s.nome))
    WHEN 'financeiro' THEN 'FIN'
    WHEN 'projetos' THEN 'PROJ'
    WHEN 'e-commerce' THEN 'ECOM'
    WHEN 'ecommerce' THEN 'ECOM'
    WHEN 'ti' THEN 'TI'
    WHEN 'expedição' THEN 'EXP'
    WHEN 'expedicao' THEN 'EXP'
    WHEN 'rh' THEN 'RH'
    WHEN 'comercial' THEN 'COM'
    WHEN 'fábrica' THEN 'FAB'
    WHEN 'fabrica' THEN 'FAB'
    WHEN 'marketing' THEN 'MKT'
    WHEN 'logística' THEN 'LOG'
    WHEN 'logistica' THEN 'LOG'
    ELSE 'OUT'
  END
  FROM public.segmentos s
  WHERE s.id = p_segmento_id;
$function$;

UPDATE public.grupos_atendimento g
SET prefixo = CASE LOWER(BTRIM(s.nome))
  WHEN 'financeiro' THEN 'SD-FIN'
  WHEN 'projetos' THEN 'SD-PROJ'
  WHEN 'e-commerce' THEN 'SD-ECOM'
  WHEN 'ecommerce' THEN 'SD-ECOM'
  WHEN 'ti' THEN 'SD-TI'
  WHEN 'expedição' THEN 'SD-EXP'
  WHEN 'expedicao' THEN 'SD-EXP'
  WHEN 'rh' THEN 'SD-RH'
  WHEN 'comercial' THEN 'SD-COM'
  WHEN 'fábrica' THEN 'SD-FAB'
  WHEN 'fabrica' THEN 'SD-FAB'
  WHEN 'marketing' THEN 'SD-MKT'
  WHEN 'logística' THEN 'SD-LOG'
  WHEN 'logistica' THEN 'SD-LOG'
  ELSE 'SD-OUT'
END
FROM public.segmentos s
WHERE s.id = g.segmento_id
  AND g.ativo = true
  AND g.prefixo IS DISTINCT FROM CASE LOWER(BTRIM(s.nome))
    WHEN 'financeiro' THEN 'SD-FIN'
    WHEN 'projetos' THEN 'SD-PROJ'
    WHEN 'e-commerce' THEN 'SD-ECOM'
    WHEN 'ecommerce' THEN 'SD-ECOM'
    WHEN 'ti' THEN 'SD-TI'
    WHEN 'expedição' THEN 'SD-EXP'
    WHEN 'expedicao' THEN 'SD-EXP'
    WHEN 'rh' THEN 'SD-RH'
    WHEN 'comercial' THEN 'SD-COM'
    WHEN 'fábrica' THEN 'SD-FAB'
    WHEN 'fabrica' THEN 'SD-FAB'
    WHEN 'marketing' THEN 'SD-MKT'
    WHEN 'logística' THEN 'SD-LOG'
    WHEN 'logistica' THEN 'SD-LOG'
    ELSE 'SD-OUT'
  END;
