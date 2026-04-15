import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Dimensions, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface DissolveModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  partnerName: string;
}

const { width } = Dimensions.get('window');

export const DissolveModal: React.FC<DissolveModalProps> = ({ visible, onCancel, onConfirm, partnerName }) => {
  
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.overlay}>
        <Animated.View 
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </Animated.View>

        <Animated.View
          entering={ZoomIn.springify().damping(15)}
          exiting={ZoomOut.duration(200)}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={['#FAF3EA', '#F5E6D3']}
            style={styles.card}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🍂</Text>
            </View>

            <Text style={styles.title}>Dissolve this Bond?</Text>
            <Text style={styles.description}>
              By dissolving your bond with <Text style={styles.bold}>{partnerName}</Text>, your shared sanctuary and ritual history will return to the earth. This action is irreversible.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onConfirm}
                style={styles.confirmButton}
                activeOpacity={0.8}
              >
                <View style={styles.goldBorder}>
                  <Text style={styles.confirmText}>Dissolve Bond</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onCancel}
                style={styles.cancelButton}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Keep the Connection</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    width: width * 0.85,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#FAF3EA',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  card: {
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0E0D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#3D2B1F',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: '#6B5A4E',
    textAlign: 'center',
    marginBottom: 28,
  },
  bold: {
    fontWeight: 'bold',
    color: '#C0624A',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  confirmButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#C0624A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D2AC47',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#3D2B1F',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.6,
  },
});
