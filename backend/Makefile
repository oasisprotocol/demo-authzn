all:
	pnpm hardhat compile
	pnpm tsc --build

deploy-local:
	pnpm hardhat --network sapphire-localnet deploy | tee ../frontend/.env.local

test: test-local

test-local:
	pnpm hardhat --network sapphire-localnet test

clean:
	rm -rf artifacts cache dist typechain-types