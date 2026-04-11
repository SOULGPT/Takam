import { Platform, ViewStyle } from 'react-native';

/**
 * A cross-platform shadow utility.
 * Use this to avoid deprecation warnings on Web while maintaining
 * consistent premium aesthetics across iOS and Android.
 */
export const shadow = (
  color: string = '#000',
  offset: { width: number; height: number } = { width: 0, height: 2 },
  opacity: number = 0.2,
  radius: number = 4,
  elevation: number = 4
): ViewStyle => {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: offset,
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
    },
    web: {
      // Convert color to rgba if possible to support opacity
      // For now, if it's a hex we'll just use it, but boxShadow is the key fix
      // @ts-ignore
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`,
    },
    default: {
      shadowColor: color,
      shadowOffset: offset,
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  }) as ViewStyle;
};
