COMPOSES := \
  cloudflared/docker-compose.yml \
  api/docker-compose.yml \
  n8n/docker-compose.yml \
  home_assistant/docker-compose.yml \
  portainer/docker-compose.yml \
  jellyfin/docker-compose.yml \
  paperless/docker-compose.yml

project = $(notdir $(patsubst %/,%,$(dir $(1))))
dc = docker compose --env-file /home/zeezoux/containers/.env -p $(call project,$(1)) -f $(1)

up:
	$(foreach c,$(COMPOSES),$(call dc,$(c)) up -d --build --remove-orphans;)

stop:
	$(foreach c,$(COMPOSES),$(call dc,$(c)) stop;)

down:
	$(foreach c,$(COMPOSES),$(call dc,$(c)) down;)

restart:
	$(foreach c,$(COMPOSES),$(call dc,$(c)) stop;)
	$(foreach c,$(COMPOSES),$(call dc,$(c)) up -d --build --remove-orphans;)

recreate:
	$(foreach c,$(COMPOSES),$(call dc,$(c)) up -d --force-recreate;)

ps:
	@set -e; \
	for c in $(COMPOSES); do \
		echo "==> $$c"; \
		$(call dc,$$c) ps; \
		echo; \
	done
