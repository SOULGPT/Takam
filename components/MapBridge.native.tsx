import React from 'react';
import MapView, { PROVIDER_GOOGLE, Region, MapViewProps } from 'react-native-maps';
import MeetingMarkMarker from './MeetingMarkMarker';

interface MapBridgeProps extends MapViewProps {
  marks: any[];
  pendingMark: any;
  selectedCategory: string | null;
  vintageMapStyle: any;
}

const MapBridge = React.forwardRef<MapView, MapBridgeProps>((props, ref) => {
  const { marks, pendingMark, selectedCategory, vintageMapStyle, ...mapProps } = props;

  return (
    <MapView
      ref={ref}
      provider={PROVIDER_GOOGLE}
      customMapStyle={vintageMapStyle}
      {...mapProps}
    >
      {marks.map((mark) => (
        <MeetingMarkMarker
          key={mark.id}
          coordinate={{ latitude: mark.latitude, longitude: mark.longitude }}
          category={mark.category}
          onPress={() => {}}
        />
      ))}

      {pendingMark && (
        <MeetingMarkMarker
          coordinate={pendingMark}
          category={selectedCategory || 'coffee'}
          onPress={() => {}}
        />
      )}
    </MapView>
  );
});

export default MapBridge;
