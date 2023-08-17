all: compile

compile:
	pnpm hardhat compile
	pnpm hardhat typechain
	pnpm tsc --build

deploy:

deploy-local: compile
	pnpm hardhat --network sapphire-localnet deploy | tee ../frontend/.env.local

test: test-local

test-local:
	pnpm hardhat --network sapphire-localnet test

clean:
	rm -rf artifacts cache dist typechain-types
