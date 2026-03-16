COMPOSE ?= docker compose
SERVICE ?= app
DEV_SERVICE ?= app-dev

.PHONY: help build up down restart logs ps dev dev-build shell shell-dev config clean destroy

help:
	@echo "Targets disponiveis:"
	@echo "  make build      - Build da imagem de producao"
	@echo "  make up         - Sobe o app em producao"
	@echo "  make down       - Para os containers"
	@echo "  make restart    - Reinicia o app de producao"
	@echo "  make logs       - Mostra logs do app de producao"
	@echo "  make ps         - Lista os servicos"
	@echo "  make dev        - Sobe o ambiente de desenvolvimento"
	@echo "  make dev-build  - Rebuild e sobe o ambiente de desenvolvimento"
	@echo "  make shell      - Abre shell no container de producao"
	@echo "  make shell-dev  - Abre shell no container de desenvolvimento"
	@echo "  make config     - Valida e imprime o docker compose final"
	@echo "  make clean      - Para containers e remove orfaos"
	@echo "  make destroy    - Remove containers e volumes"

build:
	$(COMPOSE) build $(SERVICE)

up:
	$(COMPOSE) up -d $(SERVICE)

down:
	$(COMPOSE) down --remove-orphans

restart:
	$(COMPOSE) restart $(SERVICE)

logs:
	$(COMPOSE) logs -f $(SERVICE)

ps:
	$(COMPOSE) ps

dev:
	$(COMPOSE) --profile dev up $(DEV_SERVICE)

dev-build:
	$(COMPOSE) --profile dev up --build $(DEV_SERVICE)

shell:
	$(COMPOSE) exec $(SERVICE) sh

shell-dev:
	$(COMPOSE) exec $(DEV_SERVICE) sh

config:
	$(COMPOSE) config

clean:
	$(COMPOSE) down --remove-orphans

destroy:
	$(COMPOSE) down --remove-orphans --volumes
