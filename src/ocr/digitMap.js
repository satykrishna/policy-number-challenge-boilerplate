/*
 * Defines the canonical 3x3 OCR glyph map for digits 0-9.
 */
function cell(top, mid, bot) {
  /*
   * Flatten one digit's three OCR rows into the lookup key format.
   */
  return top + mid + bot;
}

export const CANONICAL = {
  [cell(" _ ", "| |", "|_|")]: "0",
  [cell("   ", "  |", "  |")]: "1",
  [cell(" _ ", " _|", "|_ ")]: "2",
  [cell(" _ ", " _|", " _|")]: "3",
  [cell("   ", "|_|", "  |")]: "4",
  [cell(" _ ", "|_ ", " _|")]: "5",
  [cell(" _ ", "|_ ", "|_|")]: "6",
  [cell(" _ ", "  |", "  |")]: "7",
  [cell(" _ ", "|_|", "|_|")]: "8",
  [cell(" _ ", "|_|", " _|")]: "9"
};

