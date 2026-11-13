import { ChainId } from '@/utils/constants';

export const frontierContracts = {
    BatchRouter: {
        [ChainId.BASE]: '0x7D08bc34e444848983227E266F61146A7e935A94',
        [ChainId.SEPOLIA]: '0x7D08bc34e444848983227E266F61146A7e935A94',
    },
    BufferRouter: {
        [ChainId.BASE]: '0xf921Cc4B31417eED5FD1B82B15B8b5549b605630',
        [ChainId.SEPOLIA]: '0xf921Cc4B31417eED5FD1B82B15B8b5549b605630',
    },
    CompositeLiquidityRouter: {
        [ChainId.BASE]: '0x96Eb97f030C04A98EF83191d9704e5Ba7836Bf3D',
        [ChainId.SEPOLIA]: '0x96Eb97f030C04A98EF83191d9704e5Ba7836Bf3D',
    },
    GyroECLPPoolFactory: {
        [ChainId.BASE]: '0xED6D268cAdBea94c34E531C3401d41a882D66A8D',
        [ChainId.SEPOLIA]: '0xED6D268cAdBea94c34E531C3401d41a882D66A8D',
    },
    Router: {
        [ChainId.BASE]: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
        [ChainId.SEPOLIA]: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
    },
    StablePoolFactory: {
        [ChainId.BASE]: '0xB74Fe587fad28adbf152b511E199665D56D40755',
        [ChainId.SEPOLIA]: '0xB74Fe587fad28adbf152b511E199665D56D40755',
    },
    Vault: {
        [ChainId.BASE]: '0xFF00009C1A83Ec25434522ef355b99e9a70000FF',
        [ChainId.SEPOLIA]: '0xFF00009C1A83Ec25434522ef355b99e9a70000FF',
    },
    VaultAdmin: {
        [ChainId.BASE]: '0x06d62a054D4f18Fa5cCf3C4E893e2cD8878F9007',
        [ChainId.SEPOLIA]: '0x06d62a054D4f18Fa5cCf3C4E893e2cD8878F9007',
    },
    VaultExtension: {
        [ChainId.BASE]: '0xd883460167DB9a68B85ee0A3937b75a2B38d1B8E',
        [ChainId.SEPOLIA]: '0xd883460167DB9a68B85ee0A3937b75a2B38d1B8E',
    },
    WeightedPoolFactory: {
        [ChainId.BASE]: '0xC55Ea8a9de28CEDd9Eb1384CecD0D0437B71aB9a',
        [ChainId.SEPOLIA]: '0xC55Ea8a9de28CEDd9Eb1384CecD0D0437B71aB9a',
    },
} as const;
