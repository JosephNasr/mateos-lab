COMPOSES := \
  cloudflared/docker-compose.yml \
  api/docker-compose.yml \
  n8n/docker-compose.yml \
  ntfy/docker-compose.yml \
  diun/docker-compose.yml \
  home_assistant/docker-compose.yml \
  jellyfin/docker-compose.yml \
  twingate/docker-compose.yml \
  adguard/docker-compose.yml \
  uptime_kuma/docker-compose.yml \
  kopia/docker-compose.yml

STACK_NAMES := $(sort $(foreach c,$(COMPOSES),$(notdir $(patsubst %/,%,$(dir $(c))))))
STACK ?=
TAIL ?= 100
SERVICE ?=
VOLUMES ?= 0
.DEFAULT_GOAL := up

project = $(notdir $(patsubst %/,%,$(dir $(1))))
dc = docker compose --env-file /home/zeezoux/containers/.env -p $(call project,$(1)) -f $(1)

ifeq ($(strip $(STACK)),)
TARGET_COMPOSES := $(COMPOSES)
else
STACK_COMPOSE := $(STACK)/docker-compose.yml
TARGET_COMPOSES := $(filter $(STACK_COMPOSE),$(COMPOSES))
endif

define require_target_composes
	@if [ -z "$(strip $(TARGET_COMPOSES))" ]; then \
		echo "Unknown STACK='$(STACK)'."; \
		echo "Available stacks: $(STACK_NAMES)"; \
		exit 1; \
	fi
endef

define require_stack
	@if [ -z "$(strip $(STACK))" ]; then \
		echo "$(1) requires STACK=<stack>."; \
		echo "Available stacks: $(STACK_NAMES)"; \
		exit 1; \
	fi
endef

define run_each
	@set -e; \
	$(foreach c,$(TARGET_COMPOSES),echo "==> $(call project,$(c))"; $(call dc,$(c)) $(1); echo;)
endef

.PHONY: help stacks up update pull build stop down restart recreate ps logs config validate cleanup

help:
	@echo "Usage: make <target> [STACK=<stack>] [TAIL=<lines>] [SERVICE=<service>] [VOLUMES=1]"
	@echo
	@echo "Targets:"
	@echo "  help      Show this help text."
	@echo "  stacks    List the available stack names."
	@echo "  up        Start stack(s); build the local api image when included."
	@echo "  update    Pull images, then recreate stack(s) without building."
	@echo "  pull      Pull the pinned image(s) for stack(s)."
	@echo "  build     Build local images for stack(s)."
	@echo "  stop      Stop stack(s) without removing containers."
	@echo "  down      Remove stack(s) containers and Compose-managed networks."
	@echo "  restart   Stop then start stack(s); rebuild the local api image."
	@echo "  recreate  Force-recreate stack(s)."
	@echo "  ps        Show container status for stack(s)."
	@echo "  logs      Stream logs for one stack. Supports SERVICE and TAIL."
	@echo "  config    Render the merged Compose config for stack(s)."
	@echo "  validate  Validate the Compose config for stack(s)."
	@echo "  cleanup   Prune unused Docker containers, networks, images, and build cache."
	@echo "            Add VOLUMES=1 to also prune unused Docker volumes."
	@echo
	@echo "Available stacks: $(STACK_NAMES)"
	@echo
	@echo "Examples:"
	@echo "  make up"
	@echo "  make up STACK=api"
	@echo "  make update STACK=n8n"
	@echo "  make cleanup"
	@echo "  make cleanup VOLUMES=1"
	@echo "  make logs STACK=api"
	@echo "  make logs STACK=api SERVICE=api TAIL=200"

stacks:
	@printf '%s\n' $(STACK_NAMES)

up:
	$(call require_target_composes)
	@set -e; \
	$(foreach c,$(TARGET_COMPOSES),echo "==> $(call project,$(c))"; if [ "$(call project,$(c))" = "api" ]; then $(call dc,$(c)) up -d --build --remove-orphans; else $(call dc,$(c)) up -d --remove-orphans; fi; echo;)

update:
	$(call require_target_composes)
	$(call run_each,pull)
	$(call run_each,up -d --remove-orphans)

pull:
	$(call require_target_composes)
	$(call run_each,pull)

build:
	$(call require_target_composes)
	$(call run_each,build)

stop:
	$(call require_target_composes)
	$(call run_each,stop)

down:
	$(call require_target_composes)
	$(call run_each,down)

restart:
	$(call require_target_composes)
	$(call run_each,stop)
	$(MAKE) up STACK=$(STACK)

recreate:
	$(call require_target_composes)
	$(call run_each,up -d --force-recreate)

ps:
	$(call require_target_composes)
	$(call run_each,ps)

logs:
	$(call require_stack,logs)
	$(call require_target_composes)
	$(call run_each,logs -f --tail $(TAIL) $(SERVICE))

config:
	$(call require_target_composes)
	$(call run_each,config)

validate:
	$(call require_target_composes)
	$(call run_each,config -q)

cleanup:
	@if [ "$(VOLUMES)" = "1" ]; then \
		docker system prune --all --volumes --force; \
	else \
		docker system prune --all --force; \
	fi
