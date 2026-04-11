import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

interface AddressSearchProps {
  onAddressSelect: (address: string) => void;
  placeholder?: string;
}

export default function AddressSearch({ onAddressSelect, placeholder = "Search for address…" }: AddressSearchProps) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.textInput}
        placeholder={placeholder}
        placeholderTextColor="#7a8c7e"
        onChangeText={onAddressSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 10 },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5dec1',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 14,
    color: '#2d1f1a',
  },
});
