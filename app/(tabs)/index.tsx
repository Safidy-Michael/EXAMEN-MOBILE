import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';

export default function MusicPlayer() {
  const [audioFiles, setAudioFiles] = useState<MediaLibrary.Asset[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MediaLibrary.Asset | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Configurer les notifications
  useEffect(() => {
    const configureNotifications = async () => {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      // Demander les permissions pour les notifications
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Les notifications ne fonctionneront pas.');
      }
    };

    configureNotifications();
  }, []);

  // Charger les fichiers audio
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

  // Jouer un fichier audio
  async function playAudio(track: MediaLibrary.Asset, index: number) {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: track.uri },
      { shouldPlay: true }
    );

    soundRef.current = newSound;
    setSound(newSound);
    setCurrentTrack(track);
    setCurrentTrackIndex(index);
    setIsPlaying(true);

    // Configurer la lecture en arrière-plan
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Afficher une notification simple
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lecture en cours',
        body: track.filename,
        data: { trackId: track.id },
      },
      trigger: null,
    });
  }

  // Lecture/pause
  async function togglePlayback() {
    if (soundRef.current) {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  }

  // Piste suivante
  async function playNext() {
    if (currentTrackIndex < audioFiles.length - 1) {
      const nextTrackIndex = currentTrackIndex + 1;
      const nextTrack = audioFiles[nextTrackIndex];
      await playAudio(nextTrack, nextTrackIndex);
    }
  }

  // Piste précédente
  async function playPrevious() {
    if (currentTrackIndex > 0) {
      const previousTrackIndex = currentTrackIndex - 1;
      const previousTrack = audioFiles[previousTrackIndex];
      await playAudio(previousTrack, previousTrackIndex);
    }
  }

  // Gérer les interactions avec les notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      // Rediriger l'utilisateur vers l'application
      console.log('Notification cliquée:', response.notification.request.content.data.trackId);
    });

    return () => subscription.remove();
  }, []);

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
          <TouchableOpacity
            style={[
              styles.trackItem,
              currentTrackIndex === index && styles.selectedTrackItem,
            ]}
            onPress={() => playAudio(item, index)}
          >
            <Text>{item.filename}</Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={playPrevious}
          disabled={currentTrackIndex <= 0}
        >
          <Text style={styles.controlButtonText}>Précédent</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={togglePlayback}>
          <Text style={styles.controlButtonText}>{isPlaying ? 'Pause' : 'Lecture'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={playNext}
          disabled={currentTrackIndex >= audioFiles.length - 1}
        >
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
  selectedTrackItem: {
    backgroundColor: '#e0f7fa', // Couleur de fond pour la piste sélectionnée
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