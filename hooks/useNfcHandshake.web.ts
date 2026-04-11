import { useState } from 'react';

export function useNfcHandshake() {
  const [isScanning, setIsScanning] = useState(false);
  
  const startHandshake = async () => {
    console.warn('NFC is not supported on Web. Please use a physical device.');
  };

  const stopHandshake = () => {
    setIsScanning(false);
  };

  return {
    isScanning,
    startHandshake,
    stopHandshake,
    handshakeId: null,
    isProcessing: false
  };
}
