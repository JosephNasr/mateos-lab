COMPOSES := \
  cloudflared/docker-compose.yml \
  api/docker-compose.yml \
  n8n/docker-compose.yml \
  home_assistant/docker-compose.yml \
  portainer/docker-compose.yml \
  jellyfin/docker-compose.yml

STACK_NAMES := $(sort $(foreach c,$(COMPOSES),$(notdir $(patsubst %/,%,$(dir $(c))))))
STACK ?=
TAIL ?= 100
SERVICE ?=
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

.PHONY: help stacks up pull build stop down restart recreate ps logs config

help:
	@echo "Usage: make <target> [STACK=<stack>] [TAIL=<lines>] [SERVICE=<service>]"
	@echo
	@echo "Targets:"
	@echo "  help      Show this help text."
	@echo "  stacks    List the available stack names."
	@echo "  up        Start stack(s) with up -d --build --remove-orphans."
	@echo "  pull      Pull newer upstream images for stack(s)."
	@echo "  build     Build local images for stack(s)."
	@echo "  stop      Stop stack(s) without removing containers."
	@echo "  down      Remove stack(s) containers and Compose-managed networks."
	@echo "  restart   Stop then start stack(s) with a rebuild."
	@echo "  recreate  Force-recreate stack(s)."
	@echo "  ps        Show container status for stack(s)."
	@echo "  logs      Stream logs for one stack. Supports SERVICE and TAIL."
	@echo "  config    Render the merged Compose config for stack(s)."
	@echo
	@echo "Available stacks: $(STACK_NAMES)"
	@echo
	@echo "Examples:"
	@echo "  make up"
	@echo "  make up STACK=api"
	@echo "  make pull STACK=n8n"
	@echo "  make logs STACK=api"
	@echo "  make logs STACK=api SERVICE=api TAIL=200"

stacks:
	@printf '%s\n' $(STACK_NAMES)

up:
	$(call require_target_composes)
	$(call run_each,up -d --build --remove-orphans)

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
	$(call run_each,up -d --build --remove-orphans)

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
