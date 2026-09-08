import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

/** Matches DocumentReader Android vector drawables + iOS SF Symbols. */
export type TileIconName = 'camera' | 'liveness' | 'gallery' | 'about' | 'settings';

type Props = {
  name: TileIconName;
  size?: number;
  color?: string;
};

const FILL_ICONS: Partial<Record<TileIconName, string>> = {
  // ic_camera.xml
  camera:
    'M9,2L7.17,4H4c-1.1,0 -2,0.9 -2,2v12c0,1.1 0.9,2 2,2h16c1.1,0 2,-0.9 2,-2V6c0,-1.1 -0.9,-2 -2,-2h-3.17L15,2H9zM12,17c-2.76,0 -5,-2.24 -5,-5s2.24,-5 5,-5 5,2.24 5,5 -2.24,5 -5,5zM12,9c-1.66,0 -3,1.34 -3,3s1.34,3 3,3 3,-1.34 3,-3 -1.34,-3 -3,-3z',
  // ic_gallery.xml
  gallery:
    'M21,19V5c0,-1.1 -0.9,-2 -2,-2H5c-1.1,0 -2,0.9 -2,2v14c0,1.1 0.9,2 2,2h14c1.1,0 2,-0.9 2,-2zM8.5,13.5l2.5,3.01L14.5,12l4.5,6H5l3.5,-4.5z',
  // ic_info.xml
  about:
    'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM13,17h-2v-6h2v6zM13,9h-2V7h2v2z',
  settings:
    'M19.14,12.94c0.04,-0.31 0.06,-0.63 0.06,-0.94s-0.02,-0.63 -0.06,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.37 4.8,11.69 4.8,12s0.02,0.63 0.06,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6 3.6,1.62 3.6,3.6 -1.62,3.6 -3.6,3.6z',
};

// viewfinder — iOS Liveness tile (SF Symbol style corner brackets)
const LIVENESS_STROKE =
  'M3,7V5c1.1,0 2,-0.9 2,-2h2M17,3h2c1.1,0 2,0.9 2,2v2M21,17v2c0,1.1 -0.9,2 -2,2h-2M7,21H5c-1.1,0 -2,-0.9 -2,-2v-2';

export default function TileIcon({
  name,
  size = 40,
  color = colors.text,
}: Props) {
  if (name === 'liveness') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d={LIVENESS_STROKE}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={FILL_ICONS[name]!} />
    </Svg>
  );
}
