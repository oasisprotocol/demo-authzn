all:
	$(MAKE) -C backend
	$(MAKE) -C frontend

clean:
	$(MAKE) -C backend $@
	$(MAKE) -C frontend $@

pnpm:
	pnpm install
