
## Barberage

Frontend React/Vite com deploy estatico e suporte a execucao local com Docker.

## Requisitos

- Docker 24+ com `docker compose`
- GNU Make se voce quiser usar os atalhos do `Makefile`

## Configuracao

1. Copie `.env.example` para `.env`
2. Preencha pelo menos:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Ajuste `VITE_PUBLIC_APP_URL`, `APP_PORT` e `DEV_PORT` se precisar

Observacao: como o app usa Vite, as variaveis `VITE_*` sao incorporadas no build da imagem de producao. Se mudar `.env`, refaca o build. No servico `app-dev`, o `VITE_PUBLIC_APP_URL` e forcado para a porta do Vite.

## Subir em producao local

Com `make`:

```bash
make build
make up
```

Sem `make`:

```bash
docker compose build app
docker compose up -d app
```

App disponivel em `http://localhost:8080` por padrao.

## Ambiente de desenvolvimento

Com hot reload via Vite dentro do container:

```bash
make dev
```

Ou:

```bash
docker compose --profile dev up app-dev
```

App disponivel em `http://localhost:5173` por padrao.

## Comandos uteis

```bash
make logs
make shell
make down
make config
```

## Arquivos adicionados para dockerizacao

- `Dockerfile`: build multi-stage para desenvolvimento e producao
- `docker-compose.yml`: servicos `app` e `app-dev`
- `docker/nginx/default.conf`: fallback SPA para rotas do React Router
- `.dockerignore`: reduz contexto de build
- `Makefile`: atalhos operacionais
