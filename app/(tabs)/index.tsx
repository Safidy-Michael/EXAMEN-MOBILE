import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';

export default function MusicPlayer() {
  const [audioFiles, setAudioFiles] = useState<MediaLibrary.Asset[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MediaLibrary.Asset | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        let media = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
        });
        let allAudioFiles = media.assets;
        while (media.hasNextPage) {
          media = await MediaLibrary.getAssetsAsync({
            mediaType: 'audio',
            after: media.endCursor,
          });
          allAudioFiles = [...allAudioFiles, ...media.assets];
        }
        const filteredAudioFiles = allAudioFiles.filter(asset => asset.filename.endsWith('.mp3') || asset.filename.endsWith('.wav') || asset.filename.endsWith('.aac') || asset.filename.endsWith('.flac'));
        setAudioFiles(filteredAudioFiles);
      }
    })();
  }, []);

  async function playAudio(track: MediaLibrary.Asset, index: number) {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: track.uri },
      { shouldPlay: true }
    );

    setSound(newSound);
    setCurrentTrack(track);
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  }

  async function togglePlayback() {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  }

  async function playNext() {
    if (currentTrackIndex < audioFiles.length - 1) {
      const nextTrackIndex = currentTrackIndex + 1;
      const nextTrack = audioFiles[nextTrackIndex];
      await playAudio(nextTrack, nextTrackIndex);
    }
  }

  async function playPrevious() {
    if (currentTrackIndex > 0) {
      const previousTrackIndex = currentTrackIndex - 1;
      const previousTrack = audioFiles[previousTrackIndex];
      await playAudio(previousTrack, previousTrackIndex);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Lecteur de Musique</Text>
      {currentTrack && (
        <View style={styles.currentTrackContainer}>
          <Image source={{ uri: currentTrack.uri }} style={styles.albumArt} />
          <Text style={styles.currentTrackTitle}>{currentTrack.filename}</Text>
        </View>
      )}
      <FlatList
        data={audioFiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.trackItem} onPress={() => playAudio(item, index)}>
            <Text>{item.filename}</Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={playPrevious}>
          <Text style={styles.controlButtonText}>Précédent</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={togglePlayback}>
          <Text style={styles.controlButtonText}>{isPlaying ? 'Pause' : 'Lecture'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={playNext}>
          <Text style={styles.controlButtonText}>Suivant</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  currentTrackContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  albumArt: {
    width: 150,
    height: 150,
    marginBottom: 10,
    borderRadius: 10,
  },
  currentTrackTitle: {
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 10,
    color: '#555',
  },
  trackItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  controlButton: {
    padding: 15,
    backgroundColor: '#007bff',
    borderRadius: 10,
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});