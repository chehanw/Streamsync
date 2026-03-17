/**
 * SignaturePad
 *
 * A finger-draw signature canvas using PanResponder.
 * Renders strokes as smooth line segments between consecutive touch points.
 * No external dependencies required.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

type Point = { x: number; y: number };
type Stroke = Point[];

export interface SignaturePadRef {
  clear: () => void;
  hasSignature: () => boolean;
}

interface SignaturePadProps {
  onChanged: (hasSignature: boolean) => void;
  /** Called with `true` when a stroke begins, `false` when it ends. Use to disable parent ScrollView scrolling while drawing. */
  onDrawingActiveChange?: (active: boolean) => void;
  strokeColor?: string;
  backgroundColor?: string;
  height?: number;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  function SignaturePad(
    {
      onChanged,
      onDrawingActiveChange,
      strokeColor = '#1A1A1A',
      backgroundColor = '#F9F9F9',
      height = 160,
    },
    ref,
  ) {
    const [strokes, setStrokes] = useState<Stroke[]>([]);

    // Keep a ref so PanResponder callbacks (created once) always call the latest prop
    const onDrawingActiveChangeRef = useRef(onDrawingActiveChange);
    onDrawingActiveChangeRef.current = onDrawingActiveChange;

    useImperativeHandle(ref, () => ({
      clear: () => {
        setStrokes([]);
        onChanged(false);
      },
      hasSignature: () => strokes.length > 0 && strokes.some(s => s.length > 1),
    }));

    const panResponder = useRef(
      PanResponder.create({
        // Capture touches before the parent ScrollView can intercept them
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: evt => {
          onDrawingActiveChangeRef.current?.(true);
          const { locationX, locationY } = evt.nativeEvent;
          setStrokes(prev => [...prev, [{ x: locationX, y: locationY }]]);
          onChanged(true);
        },
        onPanResponderMove: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          setStrokes(prev => {
            if (prev.length === 0) return prev;
            const next = prev.slice();
            const last = next[next.length - 1];
            next[next.length - 1] = [...last, { x: locationX, y: locationY }];
            return next;
          });
        },
        onPanResponderRelease: () => {
          onDrawingActiveChangeRef.current?.(false);
        },
        onPanResponderTerminate: () => {
          onDrawingActiveChangeRef.current?.(false);
        },
      }),
    ).current;

    const isEmpty = strokes.every(s => s.length < 2);

    return (
      <View
        style={[styles.pad, { backgroundColor, height }]}
        {...panResponder.panHandlers}
      >
        {isEmpty && (
          <Text style={styles.placeholder}>Draw signature here</Text>
        )}

        {/* Render each stroke as a series of line-segment Views */}
        {strokes.map((stroke, si) =>
          stroke.slice(1).map((to, pi) => {
            const from = stroke[pi];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length < 0.5) return null;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const cx = (from.x + to.x) / 2;
            const cy = (from.y + to.y) / 2;
            return (
              <View
                key={`${si}_${pi}`}
                style={{
                  position: 'absolute',
                  left: cx - length / 2,
                  top: cy - 1.5,
                  width: length,
                  height: 3,
                  backgroundColor: strokeColor,
                  borderRadius: 1.5,
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          }),
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  pad: {
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#C0C0C0',
    fontSize: 15,
    fontStyle: 'italic',
    pointerEvents: 'none',
  },
});
