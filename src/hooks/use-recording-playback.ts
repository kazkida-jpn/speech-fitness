import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Plays back a recording URI. On the web the expo-audio player does not reliably play
 * MediaRecorder blobs, so a plain HTMLAudioElement is used there instead.
 */
export function useRecordingPlayback() {
  const player = useAudioPlayer(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      webAudioRef.current?.pause();
      webAudioRef.current = null;
    },
    []
  );

  const stop = () => {
    if (Platform.OS === 'web') {
      webAudioRef.current?.pause();
      return;
    }
    player.pause();
  };

  const play = async (uri: string) => {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (Platform.OS === 'web') {
      webAudioRef.current?.pause();
      const audio = new Audio(uri);
      webAudioRef.current = audio;
      await audio.play();
      return;
    }
    player.pause();
    player.replace(uri);
    await player.seekTo(0);
    player.play();
  };

  return { play, stop };
}
