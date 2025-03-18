import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function MusicPlayer() {
  const [allAudioFiles, setAllAudioFiles] = useState<MediaLibrary.Asset[]>([]);
  const [audioFiles, setAudioFiles] = useState<MediaLibrary.Asset[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MediaLibrary.Asset | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterBy, setFilterBy] = useState<string>('title');
  const [playlists, setPlaylists] = useState<{ name: string; tracks: MediaLibrary.Asset[] }[]>([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState<boolean>(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<MediaLibrary.Asset | null>(null);
  const [showTrackOptions, setShowTrackOptions] = useState<boolean>(false);
  const [showPlaylistsList, setShowPlaylistsList] = useState<boolean>(false);
  const [isInPlaylist, setIsInPlaylist] = useState<boolean>(false);
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string>('');
  const soundRef = useRef<Audio.Sound | null>(null);
  const notificationIdRef = useRef<string | null>(null); // Référence pour stocker l'ID de la notification

  // Configurer les notifications interactives
  useEffect(() => {
    const configureNotifications = async () => {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      await Notifications.setNotificationCategoryAsync('musicControls', [
        {
          identifier: 'previous',
          buttonTitle: '◀️',
          options: { opensAppToForeground: false },
        },
        {
          identifier: 'play_pause',
          buttonTitle: isPlaying ? '⏸️' : '▶️',
          options: { opensAppToForeground: false },
        },
        {
          identifier: 'next',
          buttonTitle: '▶️▶️',
          options: { opensAppToForeground: false },
        },
      ]);

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Les notifications ne fonctionneront pas.');
      }
    };

    configureNotifications();
  }, [isPlaying]);

  // Charger les fichiers audio
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        setIsLoading(true);
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
        const filteredAudioFiles = allAudioFiles.filter(asset => 
          asset.filename.endsWith('.mp3') || 
          asset.filename.endsWith('.wav') || 
          asset.filename.endsWith('.aac') || 
          asset.filename.endsWith('.flac')
        );
        setAllAudioFiles(filteredAudioFiles);
        setAudioFiles(filteredAudioFiles);
        setIsLoading(false);
      }
    })();
  }, []);

  // Mettre à jour la notification existante au lieu d'en créer une nouvelle
  async function updateNotification(track: MediaLibrary.Asset) {
    const content = {
      title: track.filename,
      body: 'Contrôlez la lecture depuis ici',
      data: { trackId: track.id },
      categoryIdentifier: 'musicControls',
    };

    if (notificationIdRef.current) {
      // Mettre à jour la notification existante
      await Notifications.dismissNotificationAsync(notificationIdRef.current);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
    notificationIdRef.current = notificationId;
  }

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

    const asset = await MediaLibrary.getAssetInfoAsync(track);
    setMetadata(asset);

    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Mettre à jour la notification au lieu d'en créer une nouvelle
    await updateNotification(track);
  }

  async function togglePlayback() {
    if (soundRef.current) {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
      
      // Mettre à jour la notification pour refléter l'état play/pause
      if (currentTrack) {
        await updateNotification(currentTrack);
      }
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

  // Gérer les interactions avec les notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionIdentifier = response.actionIdentifier;

      switch (actionIdentifier) {
        case 'previous':
          playPrevious();
          break;
        case 'play_pause':
          togglePlayback();
          break;
        case 'next':
          playNext();
          break;
      }
    });

    return () => subscription.remove();
  }, [currentTrackIndex, audioFiles, isPlaying]);

  // Les autres fonctions (sortTracks, createPlaylist, etc.) restent inchangées
  const sortTracks = (tracks: MediaLibrary.Asset[], filter: string) => {
    switch (filter) {
      case 'title':
        return tracks.sort((a, b) => a.filename.localeCompare(b.filename));
      case 'artist':
        return tracks.sort((a, b) => ((a as any).artist || '').localeCompare((b as any).artist || ''));
      case 'album':
        return tracks.sort((a, b) => (a.albumId || '').localeCompare(b.albumId || ''));
      default:
        return tracks;
    }
  };

  const createPlaylist = () => {
    if (newPlaylistName.trim() === '') {
      Alert.alert('Erreur', 'Le nom de la playlist ne peut pas être vide.');
      return;
    }
    setPlaylists([...playlists, { name: newPlaylistName, tracks: [] }]);
    setNewPlaylistName('');
    setShowPlaylistModal(false);
  };

  const addToPlaylist = (playlistName: string, track: MediaLibrary.Asset) => {
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.name === playlistName) {
        return { ...playlist, tracks: [...playlist.tracks, track] };
      }
      return playlist;
    });
    setPlaylists(updatedPlaylists);
    setShowAddToPlaylistModal(false);
  };

  const removeFromPlaylist = (playlistName: string, trackId: string) => {
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.name === playlistName) {
        return { ...playlist, tracks: playlist.tracks.filter(track => track.id !== trackId) };
      }
      return playlist;
    });
    setPlaylists(updatedPlaylists);
    setShowTrackOptions(false);

    if (currentPlaylistName === playlistName) {
      const updatedTracks = updatedPlaylists.find(playlist => playlist.name === playlistName)?.tracks || [];
      setAudioFiles(updatedTracks);
    }
  };

  const showTrackOptionsMenu = (track: MediaLibrary.Asset) => {
    setSelectedTrackForPlaylist(track);
    setShowTrackOptions(true);
  };

  const goBackToAllTracks = () => {
    setIsInPlaylist(false);
    setAudioFiles(allAudioFiles);
  };

  // Le rendu JSX reste identique
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Lecteur de Musique</Text>
      <View style={styles.filterIconsContainer}>
        <TouchableOpacity style={styles.filterIcon} onPress={() => setFilterBy('title')}>
          <MaterialIcons name="title" size={24} color={filterBy === 'title' ? '#007bff' : '#ccc'} />
          <Text style={[styles.filterIconText, { color: filterBy === 'title' ? '#007bff' : '#ccc' }]}>Titre</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterIcon} onPress={() => setFilterBy('artist')}>
          <MaterialIcons name="person" size={24} color={filterBy === 'artist' ? '#007bff' : '#ccc'} />
          <Text style={[styles.filterIconText, { color: filterBy === 'artist' ? '#007bff' : '#ccc' }]}>Artiste</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterIcon} onPress={() => setFilterBy('album')}>
          <MaterialIcons name="album" size={24} color={filterBy === 'album' ? '#007bff' : '#ccc'} />
          <Text style={[styles.filterIconText, { color: filterBy === 'album' ? '#007bff' : '#ccc' }]}>Album</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterIcon} onPress={() => setShowPlaylistsList(!showPlaylistsList)}>
          <MaterialIcons name="playlist-play" size={24} color="#007bff" />
          <Text style={[styles.filterIconText, { color: '#007bff' }]}>Playlists</Text>
        </TouchableOpacity>
      </View>
      {showPlaylistsList && (
        <View style={styles.playlistsList}>
          {playlists.map((playlist, index) => (
            <TouchableOpacity
              key={index}
              style={styles.playlistItem}
              onPress={() => {
                setAudioFiles(playlist.tracks);
                setIsInPlaylist(true);
                setCurrentPlaylistName(playlist.name);
                setShowPlaylistsList(false);
              }}
            >
              <Text>{playlist.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {isInPlaylist && (
        <TouchableOpacity style={styles.backButton} onPress={goBackToAllTracks}>
          <Ionicons name="arrow-back" size={24} color="#007bff" />
          <Text style={styles.backButtonText}>Retour à la liste complète</Text>
        </TouchableOpacity>
      )}
      <Modal visible={showPlaylistModal} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nom de la playlist"
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
          />
          <TouchableOpacity style={styles.modalButton} onPress={createPlaylist}>
            <Text style={styles.modalButtonText}>Créer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton} onPress={() => setShowPlaylistModal(false)}>
            <Text style={styles.modalButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={showAddToPlaylistModal} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Ajouter à une playlist</Text>
          {playlists.length === 0 ? (
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowPlaylistModal(true)}>
              <Text style={styles.modalButtonText}>Créer une nouvelle playlist</Text>
            </TouchableOpacity>
          ) : (
            playlists.map((playlist, index) => (
              <TouchableOpacity
                key={index}
                style={styles.playlistItem}
                onPress={() => addToPlaylist(playlist.name, selectedTrackForPlaylist!)}
              >
                <Text>{playlist.name}</Text>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.modalButton} onPress={() => setShowAddToPlaylistModal(false)}>
            <Text style={styles.modalButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <FlatList
        data={sortTracks(audioFiles, filterBy)}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.trackItem,
              currentTrackIndex === index && styles.selectedTrackItem,
            ]}
            onPress={() => playAudio(item, index)}
          >
            {metadata?.artwork ? (
              <Image source={{ uri: metadata.artwork }} style={styles.trackIcon} />
            ) : (
              <Ionicons name="musical-notes" size={32} color="#007bff" style={styles.trackIcon} />
            )}
            <Text style={styles.trackText}>{item.filename}</Text>
            <TouchableOpacity onPress={() => showTrackOptionsMenu(item)}>
              <Ionicons name="ellipsis-vertical" size={24} color="#007bff" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
      <Modal visible={showTrackOptions} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Options</Text>
          <TouchableOpacity style={styles.modalButton} onPress={() => { playAudio(selectedTrackForPlaylist!, audioFiles.indexOf(selectedTrackForPlaylist!)); setShowTrackOptions(false); }}>
            <Text style={styles.modalButtonText}>Lire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton} onPress={() => { setShowAddToPlaylistModal(true); setShowTrackOptions(false); }}>
            <Text style={styles.modalButtonText}>Ajouter à la playlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton} onPress={() => { removeFromPlaylist(currentPlaylistName, selectedTrackForPlaylist!.id); }}>
            <Text style={styles.modalButtonText}>Supprimer de la playlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton} onPress={() => setShowTrackOptions(false)}>
            <Text style={styles.modalButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={playPrevious}
          disabled={currentTrackIndex <= 0}
        >
          <Ionicons name="play-skip-back" size={32} color={currentTrackIndex <= 0 ? '#ccc' : '#007bff'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={togglePlayback}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#007bff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={playNext}
          disabled={currentTrackIndex >= audioFiles.length - 1}
        >
          <Ionicons name="play-skip-forward" size={32} color={currentTrackIndex >= audioFiles.length - 1 ? '#ccc' : '#007bff'} />
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
  filterIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  filterIcon: {
    alignItems: 'center',
  },
  filterIconText: {
    fontSize: 12,
    marginTop: 5,
  },
  playlistsList: {
    marginBottom: 20,
  },
  playlistItem: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 5,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    marginLeft: 10,
    color: '#007bff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  input: {
    width: '80%',
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalButton: {
    padding: 15,
    backgroundColor: '#007bff',
    borderRadius: 10,
    marginBottom: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
  },
  selectedTrackItem: {
    backgroundColor: '#e0f7fa',
  },
  trackIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  trackText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
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
    borderRadius: 10,
  },
});