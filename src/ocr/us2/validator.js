/*
 * Validates 9-digit policy numbers using the US2 checksum rule.
 */
export class ChecksumValidator {
  static LENGTH = 9;

  static isValid(number) {
    /*
     * Reject malformed numbers early, then apply weighted checksum.
     */
    if (number.length !== ChecksumValidator.LENGTH || !/^\d+$/.test(number)) {
      return false;
    }

    const digits = Array.from(number, (char) => Number(char));
    /*
     * US2 checksum applies weights 1..9 from right to left.
     * Reversing lets us use index-based multiplication directly.
     */
    const total = digits
      .slice()
      .reverse()
      .reduce((sum, digit, index) => sum + (index + 1) * digit, 0);
    return total % 11 === 0;
  }
}

