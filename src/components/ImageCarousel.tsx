import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/useAppTheme';

type Props = {
  images: readonly string[];
  height?: number;
};

export function ImageCarousel({ images, height = 180 }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <View
        testID="image-placeholder"
        style={[
          styles.placeholder,
          { height, backgroundColor: theme.background },
        ]}
      >
        <Text style={{ color: theme.textHint }}>⛷</Text>
      </View>
    );
  }

  return (
    <View
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(url) => url}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index }) => (
            <Image
              source={{ uri: item }}
              accessibilityLabel={
                images.length > 1
                  ? `${t('offers.imageAlt')} ${index + 1}/${images.length}`
                  : t('offers.imageAlt')
              }
              contentFit="cover"
              style={{ width, height }}
            />
          )}
        />
      )}
      {images.length > 1 && (
        <View
          style={styles.dots}
          testID="image-dots"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {images.map((url, i) => (
            <View
              key={url}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: '#FFFFFF' },
});
