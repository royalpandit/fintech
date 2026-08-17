/**
 * Dark-only: the appearance menu has nothing left to offer.
 *
 * The props are still declared (and ignored) because four shells render this
 * with an `onSelect` handler; keeping the signature avoids touching them.
 */
type Props = {
  onSelect?: () => void;
};

export default function ThemeToggleMenu(_props: Props) {
  return null;
}
