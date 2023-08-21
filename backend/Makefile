all: compile typechain tsc

.PHONY: compile
compile:
	pnpm hardhat compile

.PHONY: typechain
typechain:
	pnpm hardhat typechain

.PHONY: tsc
tsc:
	pnpm tsc --build

.PHONY: deploy
deploy: deploy-local

.PHONY: deploy-local
deploy-local: compile
	pnpm hardhat --network sapphire-localnet deploy | tee ../frontend/.env.local

.PHONY: deploy-staging
deploy-staging: compile
	pnpm hardhat --network sapphire-testnet deploy | tee ../frontend/.env.staging

.PHONY: test
test: test-local

.PHONY: test-local
test-local:
	pnpm hardhat --network sapphire-localnet test

.PHONY: clean
clean:
	rm -rf artifacts cache dist typechain-types
