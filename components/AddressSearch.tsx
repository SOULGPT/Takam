import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

interface AddressSearchProps {
  onAddressSelect: (address: string) => void;
  placeholder?: string;
}

export default function AddressSearch({ onAddressSelect, placeholder = "Search for address…" }: AddressSearchProps) {
  return (
    <View style={styles.container}>
      <GooglePlacesAutocomplete
        placeholder={placeholder}
        onPress={(data) => {
          onAddressSelect(data.description);
        }}
        query={{
          key: 'YOUR_GOOGLE_PLACES_API_KEY', // Recommended to move to env
          language: 'en',
        }}
        styles={{
          textInput: styles.textInput,
          listView: styles.listView,
          container: styles.autocompleteContainer,
        }}
        enablePoweredByContainer={false}
        debounce={400}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, zIndex: 1000 },
  autocompleteContainer: { flex: 0 },
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
  listView: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e5dec1',
  },
});
