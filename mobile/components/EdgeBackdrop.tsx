import { useState } from 'react'
import { View, StyleSheet, Image } from 'react-native'

type EdgeBackdropProps = {
  candleImageUri?: string
}

export default function EdgeBackdrop({ candleImageUri }: EdgeBackdropProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showCandleImage = Boolean(candleImageUri) && !imageFailed

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <View style={styles.darkGradientFallback} />
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteBottom} />

      <View style={styles.glowOuter} />
      <View style={styles.glowInner} />

      <View style={styles.candleWrap}>
        {showCandleImage ? (
          <Image
            source={{ uri: candleImageUri as string }}
            style={styles.candleImage}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.candle}>
            <View style={styles.wick} />
            <View style={styles.flameOuter}>
              <View style={styles.flameInner} />
            </View>
          </View>
        )}
        {imageFailed && <View style={styles.imageErrorGradient} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#060606',
  },
  darkGradientFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
    opacity: 1,
  },
  vignetteTop: {
    position: 'absolute',
    top: -160,
    left: -80,
    right: -80,
    height: 320,
    backgroundColor: '#000000',
    opacity: 0.35,
    borderRadius: 200,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: -220,
    left: -120,
    right: -120,
    height: 420,
    backgroundColor: '#000000',
    opacity: 0.55,
    borderRadius: 300,
  },
  glowOuter: {
    position: 'absolute',
    top: '33%',
    alignSelf: 'center',
    width: 220,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#9F3D00',
    opacity: 0.2,
  },
  glowInner: {
    position: 'absolute',
    top: '36%',
    alignSelf: 'center',
    width: 140,
    height: 220,
    borderRadius: 120,
    backgroundColor: '#F7B500',
    opacity: 0.11,
  },
  candleWrap: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    width: 86,
    height: 188,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  candleImage: {
    width: '100%',
    height: '100%',
    opacity: 0.92,
  },
  imageErrorGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020202',
    opacity: 0.25,
    borderRadius: 24,
  },
  candle: {
    width: 54,
    height: 170,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#7A4B0A',
    opacity: 0.92,
    alignItems: 'center',
  },
  wick: {
    position: 'absolute',
    top: -10,
    width: 2,
    height: 12,
    backgroundColor: '#2A2A2A',
  },
  flameOuter: {
    position: 'absolute',
    top: -82,
    width: 32,
    height: 92,
    borderRadius: 30,
    backgroundColor: '#F8B12D',
    opacity: 0.85,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  flameInner: {
    width: 14,
    height: 66,
    borderRadius: 14,
    backgroundColor: '#FFF0CA',
    marginBottom: 8,
    opacity: 0.95,
  },
})
