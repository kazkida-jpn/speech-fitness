import { Image, StyleSheet } from 'react-native';

// The logo mark as an image. Kept as a PNG so it renders identically on web and native
// without an SVG dependency. Source of truth is assets/brand/mark.svg.
const MARK = require('@/assets/images/splash-icon.png');

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={MARK}
      style={[styles.mark, { width: size, height: size }]}
      accessibilityLabel="発話フィットネス"
    />
  );
}

const styles = StyleSheet.create({
  mark: { resizeMode: 'contain' },
});
