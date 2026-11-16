import { Address } from '@/types';

export function isSameAddress(address1: Address, address2: Address) {
    return address1.toLowerCase() === address2.toLowerCase();
}
