import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../store/useCallStore';

const { width } = Dimensions.get('window');

export default function CallScreen() {
  const { status, resetCall } = useCallStore();

  if (status === 'idle') return null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2D1F1A', '#1A0F09']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.content}>
        <Ionicons name="videocam-off-outline" size={64} color="#B5947A" />
        <Text style={styles.title}>The Sanctuary Awaits</Text>
        <Text style={styles.message}>
          The Private Sanctuary is an immersive HD experience designed specifically for mobile hardware. 
        </Text>
        <Text style={styles.subMessage}>
          Please open TAKAM on your phone to manifest this bond.
        </Text>

        <TouchableOpacity style={styles.closeBtn} onPress={resetCall}>
          <Text style={styles.closeBtnText}>RETURN TO CHAT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D1F1A', justifyContent: 'center', alignItems: 'center' },
  content: { 
    alignItems: 'center', 
    padding: 40, 
    maxWidth: 500,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(181, 148, 122, 0.2)'
  },
  title: { 
    color: '#F5ECD7', 
    fontSize: 28, 
    fontFamily: 'CormorantGaramond_700Bold', 
    marginTop: 20 
  },
  message: { 
    color: '#B5947A', 
    fontSize: 18, 
    textAlign: 'center', 
    marginTop: 20,
    lineHeight: 26,
    fontFamily: 'CormorantGaramond_400Regular'
  },
  subMessage: { 
    color: '#8A705E', 
    fontSize: 14, 
    textAlign: 'center', 
    marginTop: 10,
    fontStyle: 'italic'
  },
  closeBtn: { 
    marginTop: 40,
    backgroundColor: '#C47A52', 
    paddingHorizontal: 30, 
    paddingVertical: 15, 
    borderRadius: 30 
  },
  closeBtnText: { color: '#F5ECD7', fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
});
