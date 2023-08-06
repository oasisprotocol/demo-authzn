export interface NetworkDefinition {
    chainName: string;
    rpcUrls: string[];
}

export const NETWORKS : {[key: number]: NetworkDefinition} = {
    1: {
        chainName: 'Ethereum',
        rpcUrls: [
            'https://rpc.ankr.com/eth',
            'https://ethereum.publicnode.com',
            'https://eth-mainnet.public.blastapi.io'
        ]
    },
    56: {
        chainName: 'BSC',
        rpcUrls: [
            'https://bsc-dataseed1.binance.org/',
            'https://bsc-dataseed2.binance.org/',
            'https://bsc-dataseed3.binance.org/',
            'https://bsc-dataseed4.binance.org/',
            'https://bsc-dataseed1.defibit.io/',
            'https://bsc-dataseed2.defibit.io/',
            'https://bsc-dataseed3.defibit.io/',
            'https://bsc-dataseed4.defibit.io/',
            'https://bsc-dataseed1.ninicoin.io/',
            'https://bsc-dataseed2.ninicoin.io/',
            'https://bsc-dataseed3.ninicoin.io/',
            'https://bsc-dataseed4.ninicoin.io/',
        ]
    },
    96: {
        chainName: 'BSC Testnet',
        rpcUrls: [
            'https://data-seed-prebsc-1-s1.binance.org:8545/',
            'https://data-seed-prebsc-2-s1.binance.org:8545/',
            'https://data-seed-prebsc-1-s3.binance.org:8545/',
            'https://data-seed-prebsc-2-s3.binance.org:8545/',
        ]
    },
    0x5afe: {
        chainName: 'Sapphire',
        rpcUrls: ['https://sapphire.oasis.io'],
    },
    0x5aff: {
        chainName: 'Sapphire Testnet',
        rpcUrls: ['https://testnet.sapphire.oasis.dev'],
    },
    0x5afd: {
        chainName: 'Sapphire Localnet',
        rpcUrls: ['http://127.0.0.1:8545'],
    },
    1337: {
        chainName: 'Local',
        rpcUrls: ['http://127.0.0.1:8545'],
    }
}