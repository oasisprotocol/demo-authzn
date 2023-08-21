all:
	$(MAKE) -C backend
	$(MAKE) -C frontend

staging:
	$(MAKE) -C backend
	$(MAKE) -C frontend $@

clean:
	$(MAKE) -C backend $@
	$(MAKE) -C frontend $@

SAPPHIRE_DEV_DOCKER=ghcr.io/oasisprotocol/sapphire-dev:latest

# See: https://github.com/oasisprotocol/oasis-web3-gateway/pkgs/container/sapphire-dev
sapphire-dev-pull:
	docker pull $(SAPPHIRE_DEV_DOCKER)

sapphire-dev:
	docker run --rm -it -p8545:8545 -p8546:8546 -e SAPPHIRE_BACKEND=mock $(SAPPHIRE_DEV_DOCKER) -to 'test test test test test test test test test test test junk' -n 20

pnpm:
	pnpm install
