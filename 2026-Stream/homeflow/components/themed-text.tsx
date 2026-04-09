import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, FontWeight } from '@/lib/theme/typography';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: FontSize.subhead,
    lineHeight: 22,
  },
  defaultSemiBold: {
    fontSize: FontSize.subhead,
    lineHeight: 22,
    fontWeight: FontWeight.semibold,
  },
  title: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: FontSize.titleSmall,
    fontWeight: FontWeight.bold,
  },
  link: {
    lineHeight: 30,
    fontSize: FontSize.subhead,
    color: '#0a7ea4',
  },
});
