// The app name, set the way the logo sets it: cream letterforms with the first
// "o" replaced by the clock — a ring whose top-right quarter is the brand orange,
// hands pointing at 12 and 4.
//
// Drawn rather than imported so it stays crisp at any size and picks up the theme
// colours, instead of shipping a bitmap of the wordmark.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { C, FONT } from '../lib/theme';

export function Wordmark({ size = 19 }: { size?: number }) {
  // The clock stands in for a lowercase "o", so it matches x-height, not cap height.
  const glyph = size * 0.58;
  const letter = {
    fontFamily: FONT,
    fontSize: size,
    lineHeight: size * 1.15,
    fontWeight: '700' as const,
    color: C.text,
    letterSpacing: -size * 0.02,
  };
  return (
    <View style={s.row} accessibilityRole="header" accessibilityLabel="Doom">
      <Text style={letter}>D</Text>
      <View style={{ marginHorizontal: size * 0.035, marginTop: size * 0.12 }}>
        <ClockGlyph size={glyph} />
      </View>
      <Text style={letter}>om</Text>
    </View>
  );
}

function ClockGlyph({ size }: { size: number }) {
  // Heavy ring to match the weight of the letterforms next to it.
  const w = 3.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9.2} stroke={C.text} strokeWidth={w} fill="none" />
      <Path
        d="M12 2.8 A 9.2 9.2 0 0 1 21.2 12"
        stroke={C.accent}
        strokeWidth={w}
        strokeLinecap="butt"
        fill="none"
      />
      <Line x1={12} y1={12} x2={12} y2={7.2} stroke={C.text} strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={12} x2={15.4} y2={14.6} stroke={C.text} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
