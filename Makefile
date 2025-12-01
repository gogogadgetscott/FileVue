SHELL := /bin/bash
ROOT_DIR := $(shell pwd)
SERVER_DIR := $(ROOT_DIR)/server
CLIENT_DIR := $(ROOT_DIR)/client
DOCKER_COMPOSE ?= docker compose

.PHONY: help install install-server install-client build build-client build-server server-dev client-dev docker-build docker-up docker-down docker-logs docker-restart clean full-build

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z0-9_.-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS=":.*##"} {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install-server: ## Install server dependencies
	cd $(SERVER_DIR) && npm install

install-client: ## Install client dependencies
	cd $(CLIENT_DIR) && npm install

install: install-server install-client ## Install server and client dependencies

build-client: ## Build the client
	cd $(CLIENT_DIR) && npm run build

server-dev: ## Run the API in development mode
	cd $(SERVER_DIR) && npm run dev

client-dev: ## Run the React dev server (Vite)
	cd $(CLIENT_DIR) && npm run dev

run-dev: build-client server-dev client-dev ## Build and run in development mode

docker-build: ## Build Docker images
	$(DOCKER_COMPOSE) build

docker-up: ## Start the stack in detached mode
	$(DOCKER_COMPOSE) up -d

docker-down: ## Stop the stack
	$(DOCKER_COMPOSE) down

docker-logs: ## Tail logs from the explorer service
	$(DOCKER_COMPOSE) logs -f explorer

docker-restart: docker-down docker-up ## Restart the stack

docker-shell: ## Open shell in app container
	docker compose up -d --remove-orphans && docker exec -it filevue su

hash-password: ## Generate a password hash (usage: make hash-password PASS=yourpassword)
	@node $(SERVER_DIR)/hash-password.js "$(PASS)"

certs: ## Generate self-signed SSL certificates for HTTPS
	mkdir -p $(ROOT_DIR)/certs
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout $(ROOT_DIR)/certs/key.pem -out $(ROOT_DIR)/certs/cert.pem \
		-subj "/CN=localhost"
	@echo "SSL certificates generated in $(ROOT_DIR)/certs/"

clean: ## Remove dependencies and build artifacts
	rm -rf $(SERVER_DIR)/node_modules $(CLIENT_DIR)/node_modules $(CLIENT_DIR)/dist

clean-certs: ## Remove SSL certificates
	rm -rf $(ROOT_DIR)/certs
