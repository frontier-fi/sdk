import { CreatePoolInput } from '@/entities/createPool';
import { TokenType } from '@/types';
import { zeroAddress } from 'viem';

export const validateCreatePoolTokenConfig = (input: CreatePoolInput) => {
    input.tokens.forEach(({ tokenType, rateProvider }) => {
        if (tokenType !== TokenType.STANDARD && rateProvider === zeroAddress) {
            throw new Error(
                'Only TokenType.STANDARD is allowed to have zeroAddress rateProvider',
            );
        }
    });
};
