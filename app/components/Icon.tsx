// Tab-bar and list icons drawn in the SF Symbols idiom: filled silhouettes on a
// 24pt grid, colour (not shape) marking the selected tab — the same thing Photos
// and Music do. expo-symbols can't help here: on web it substitutes Material
// Symbols, which would make the PWA look like Android.
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import { useColors } from '../lib/theme';

export type IconName = 'person' | 'people' | 'gear' | 'chart' | 'chevron' | 'chevronDown' | 'check' | 'clock';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Colour behind the icon — used to punch the gear's hole and to separate the
   *  two overlapping figures in `people`. Must match what sits underneath. */
  bg?: string;
};

export function Icon({ name, size = 26, color: colorProp, bg: bgProp }: Props) {
  const C = useColors();
  const color = colorProp ?? C.text;
  const bg = bgProp ?? C.card;
  const p = { width: size, height: size, viewBox: '0 0 24 24' };

  if (name === 'person') {
    return (
      <Svg {...p}>
        <Circle cx={12} cy={7.6} r={3.9} fill={color} />
        <Path
          d="M12 13.4c-4.1 0-7.4 2.7-7.4 6.5 0 .6.5 1.1 1.1 1.1h12.6c.6 0 1.1-.5 1.1-1.1 0-3.8-3.3-6.5-7.4-6.5z"
          fill={color}
        />
      </Svg>
    );
  }

  if (name === 'people') {
    // Back figure first, then a bg-coloured halo under the front one so the two
    // read as separate bodies instead of a blob.
    return (
      <Svg {...p}>
        <G>
          <Circle cx={6.6} cy={8.6} r={3} fill={color} />
          <Path
            d="M6.6 13c-3.2 0-5.7 2.1-5.7 5.1 0 .5.4.9.9.9h9.6c.5 0 .9-.4.9-.9 0-3-2.5-5.1-5.7-5.1z"
            fill={color}
          />
        </G>
        <G>
          <Circle cx={15} cy={8} r={4.6} fill={bg} />
          <Path
            d="M15 13.2c-4.3 0-7.7 2.8-7.7 6.8 0 .7.5 1.2 1.2 1.2h13c.7 0 1.2-.5 1.2-1.2 0-4-3.4-6.8-7.7-6.8z"
            fill={bg}
          />
          <Circle cx={15} cy={8.1} r={3.5} fill={color} />
          <Path
            d="M15 14.3c-3.6 0-6.5 2.4-6.5 5.8 0 .6.4 1 1 1h11c.6 0 1-.4 1-1 0-3.4-2.9-5.8-6.5-5.8z"
            fill={color}
          />
        </G>
      </Svg>
    );
  }

  if (name === 'gear') {
    return (
      <Svg {...p}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <Rect
            key={deg}
            x={10.5}
            y={1.1}
            width={3}
            height={5}
            rx={1.3}
            fill={color}
            transform={`rotate(${deg} 12 12)`}
          />
        ))}
        <Circle cx={12} cy={12} r={6.7} fill={color} />
        <Circle cx={12} cy={12} r={2.6} fill={bg} />
      </Svg>
    );
  }

  if (name === 'chart') {
    // Three bars of different heights — a podium read at tab-bar size.
    return (
      <Svg {...p}>
        <Rect x={3.2} y={12.4} width={4.6} height={8.4} rx={1.6} fill={color} />
        <Rect x={9.7} y={5.2} width={4.6} height={15.6} rx={1.6} fill={color} />
        <Rect x={16.2} y={9.2} width={4.6} height={11.6} rx={1.6} fill={color} />
      </Svg>
    );
  }

  if (name === 'clock') {
    return (
      <Svg {...p}>
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
        <Path d="M12 6.6V12l3.6 2.4" stroke={color} strokeWidth={2} strokeLinecap="round"
          strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }

  if (name === 'chevronDown') {
    return (
      <Svg {...p}>
        <Path d="M5 9l7 7 7-7" stroke={color} strokeWidth={2.6} strokeLinecap="round"
          strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }

  if (name === 'check') {
    return (
      <Svg {...p}>
        <Path d="M4.5 12.6l5 5 10-10.5" stroke={color} strokeWidth={2.6} strokeLinecap="round"
          strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }

  // chevron — the iOS list disclosure indicator
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 5l7 7-7 7"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
