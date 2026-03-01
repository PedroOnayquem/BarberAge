# Teste E2E Manual - Localizacao da Barbearia

Objetivo: validar que o destino do "Como chegar" usa exclusivamente `shops.latitude` e `shops.longitude`.

## Pre-requisitos

- Ambiente com migrations aplicadas.
- Edge Function `geocode-shop-location` publicada.
- Frontend rodando em modo dev para logs de console.

## Passo a passo

1. Cadastrar/editar barbearia com endereco completo:
   rua, numero, bairro, cidade, UF e CEP.
2. Salvar configuracoes no painel da barbearia.
3. Confirmar no Supabase (`public.shops`) que os campos foram gravados:
   - `latitude`
   - `longitude`
   - `formatted_address`
   - `geocoded_at`
   - `geocode_precision`
   - `geocode_provider`
4. Abrir como cliente a pagina da barbearia e clicar em `Como chegar`.
5. Validar que o marcador de destino bate com o endereco no Google Maps.
6. Permitir localizacao do usuario e validar recalc da rota.

## Logs esperados em dev

- Ao abrir modal de direcoes:
  - `shopId`
  - `lat`
  - `lng`
  - `formatted_address`
- Ao obter origem do usuario:
  - `shopId`
  - `lat`
  - `lng`

## Cenarios de erro que devem funcionar

- Sem `latitude/longitude`: modal exibe `Localizacao nao configurada`, sem rota interna, com botao `Abrir no Google Maps`.
- Latitude/longitude invertidos: sistema corrige automaticamente e emite warning em dev.
- CEP ou numero ausentes ao salvar: bloqueio com mensagem `Informe CEP e numero para precisao.`.
